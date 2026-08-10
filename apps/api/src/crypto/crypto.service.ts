import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * At-rest shifrlash — AES-256-GCM (autentifikatsiyalangan shifr).
 *
 * Maqsad: DB'da ochiq saqlanmasligi kerak bo'lgan maxfiy ma'lumotlar —
 * connector tokenlari (telegram/whatsapp/SMS/SMTP/CRM), 2FA TOTP sirlari,
 * brauzer sessiya holati, qo'ng'iroq yozuvlari. DB dampi o'g'irlansa ham,
 * kalit alohida bo'lgani uchun sirlar ochilmaydi.
 *
 * Format:
 *   <version>:<iv_b64>:<authTag_b64>:<ciphertext_b64>
 *
 * ─────────────────────────────────────────────────────────────────────
 * SEC-14 — KALIT VERSIYALASH (kalit rotatsiyasi)
 * ─────────────────────────────────────────────────────────────────────
 * `version` — ALGORITM emas, KALIT AVLODI. Ya'ni prefiks qaysi kalit bilan
 * deshifrlash kerakligini BIR MA'NODA aytadi. "Bir nechta kalitni navbat
 * bilan sinab ko'rish" YO'Q — bu kalit-chalkashligiga (key confusion) yo'l
 * ochardi va qaysi kalit ishlaganini auditlab bo'lmasdi.
 *
 * Konfiguratsiya:
 *   ENCRYPTION_KEY                   — JORIY kalit (yozish + o'qish)
 *   ENCRYPTION_KEY_VERSION           — joriy versiya tegi (default `v1`)
 *   ENCRYPTION_KEY_PREVIOUS          — OLDINGI kalit (FAQAT o'qish)
 *   ENCRYPTION_KEY_PREVIOUS_VERSION  — oldingi versiya tegi
 *
 * Rotatsiyagacha: faqat `v1 -> joriy kalit` mavjud — ya'ni MAVJUD ma'lumot
 * va mavjud `.env` hech qanday o'zgarishsiz ishlayveradi.
 *
 * Rotatsiya paytida ikkala kalit ham yuklanadi, shuning uchun yarim
 * ko'chirilgan baza TO'LIQ o'qiladi (v1 — eski kalit, v2 — yangi kalit).
 * Yozish HAR DOIM joriy versiyada bo'ladi.
 *
 * Rotatsiya tugagach operator `ENCRYPTION_KEY_PREVIOUS*` ni olib tashlaydi —
 * shundan keyin eski kalit bilan shifrlangan yozuv qolmagani `--verify`
 * bilan ISBOTLANGAN bo'lishi shart (runbook: docs/runbooks/secret-rotation.md).
 *
 * ORQAGA-MOSLIK: `decrypt*` metodlari shifrlanmagan (legacy plaintext)
 * qiymatni o'zini qaytaradi — mavjud plaintext yozuvlar migratsiyasiz
 * ishlaydi. LEKIN versiyalangan, biroq NOMA'LUM versiyali blob plaintext
 * deb qabul QILINMAYDI — u xato beradi (fail-closed): aks holda shifrmatn
 * "sir" sifatida tashqariga qaytarilardi.
 */

const ALGO = 'aes-256-gcm';
const DEFAULT_VERSION = 'v1';
const DEV_KEY_SEED = 'agentnet-dev-encryption-key-do-not-use-in-prod';

/** `v1:`, `v2:` ... — versiyalangan shifrmatnning SHAKLI (kalitdan mustaqil). */
const CIPHERTEXT_PREFIX_RE = /^v\d+:/;
/** Versiya tegining o'zi. */
const VERSION_RE = /^v\d+$/;

/**
 * Prod'da kalit uchun minimal xom uzunlik.
 *
 * NEGA UZUNLIK, NEGA QAT'IY 64-hex EMAS: mavjud prod kaliti Render
 * `generateValue: true` bilan yaratilgan (64-hex EMAS) va u sha256 orqali
 * 32 baytga keltiriladi. Qat'iy hex talab qilish JONLI ma'lumotni
 * o'qib bo'lmaydigan qilardi va boot'ni qulatardi. Shuning uchun
 * derivatsiya O'ZGARMAYDI, lekin ochiq-oydin zaif ("123") kalit prod'da
 * ENDI boot'da rad etiladi.
 */
const MIN_PROD_KEY_LENGTH = 32;

@Injectable()
export class CryptoService {
  private readonly logger = new Logger('CryptoService');

  /** Versiya -> kalit. Yozish uchun `currentVersion` ishlatiladi. */
  private readonly keyring: Map<string, Buffer>;
  private readonly currentVersion: string;
  private readonly previousVersion: string | null;

  constructor() {
    const isProd = process.env.NODE_ENV === 'production';

    this.currentVersion = readVersion('ENCRYPTION_KEY_VERSION', DEFAULT_VERSION);
    const currentKey = this.loadCurrentKey(isProd);

    this.keyring = new Map([[this.currentVersion, currentKey]]);

    // --- Oldingi kalit (faqat rotatsiya oynasida) ---
    const prevRaw = process.env.ENCRYPTION_KEY_PREVIOUS?.trim();
    const prevVersionRaw = process.env.ENCRYPTION_KEY_PREVIOUS_VERSION?.trim();

    // Yarim konfiguratsiya — JIM ishlamaydi. Ikkalasi ham bo'lishi yoki
    // ikkalasi ham bo'lmasligi SHART, aks holda operator "rotatsiya
    // sozlandi" deb o'ylab, aslida eski ma'lumotni o'qiy olmasdi.
    if (!!prevRaw !== !!prevVersionRaw) {
      throw new Error(
        'ENCRYPTION_KEY_PREVIOUS va ENCRYPTION_KEY_PREVIOUS_VERSION BIRGA ' +
          "berilishi shart (biri berilib, ikkinchisi qoldirilgan). Rotatsiya runbook'iga qarang.",
      );
    }

    if (prevRaw && prevVersionRaw) {
      if (!VERSION_RE.test(prevVersionRaw)) {
        throw new Error("ENCRYPTION_KEY_PREVIOUS_VERSION formati noto'g'ri (kutilgan: v1, v2, ...)");
      }
      if (prevVersionRaw === this.currentVersion) {
        throw new Error(
          'ENCRYPTION_KEY_PREVIOUS_VERSION joriy versiya bilan bir xil — ' +
            'rotatsiyada versiya OSHIRILISHI shart (masalan v1 -> v2).',
        );
      }
      this.previousVersion = prevVersionRaw;
      this.keyring.set(prevVersionRaw, deriveKey(prevRaw));
      this.logger.log(
        `Kalit rotatsiyasi rejimi: yozish=${this.currentVersion}, o'qish=[${[...this.keyring.keys()].join(', ')}]`,
      );
    } else {
      this.previousVersion = null;
    }
  }

  /**
   * Joriy kalitni yuklaydi.
   *
   * DERIVATSIYA O'ZGARMAGAN (jonli ma'lumot shunga bog'liq):
   *   • 64 hex belgi -> to'g'ridan-to'g'ri 32 bayt,
   *   • aks holda -> sha256(raw) -> 32 bayt.
   */
  private loadCurrentKey(isProd: boolean): Buffer {
    const raw = process.env.ENCRYPTION_KEY;

    if (raw && raw.trim()) {
      const trimmed = raw.trim();
      if (isProd && trimmed.length < MIN_PROD_KEY_LENGTH) {
        // Kalitning O'ZI xato matnida HECH QACHON ko'rsatilmaydi.
        throw new Error(
          `ENCRYPTION_KEY prod uchun juda qisqa (kamida ${MIN_PROD_KEY_LENGTH} belgi). ` +
            '`openssl rand -hex 32` bilan yarating.',
        );
      }
      return deriveKey(trimmed);
    }

    if (isProd) {
      // Prod'da kalitsiz ishga tushmaydi — sirlar himoyasiz qolmasligi uchun.
      throw new Error(
        'ENCRYPTION_KEY production uchun SHART (at-rest AES-256-GCM shifrlash). ' +
          '`openssl rand -hex 32` bilan yarating.',
      );
    }

    // Dev: barqaror derivativ kalit — restartlar orasida round-trip ishlaydi.
    this.logger.warn(
      'ENCRYPTION_KEY sozlanmagan — DEV derivativ kalit ishlatilmoqda. Prod uchun SHART.',
    );
    return crypto.createHash('sha256').update(DEV_KEY_SEED).digest();
  }

  encrypt(plaintext: string): string {
    const key = this.keyring.get(this.currentVersion) as Buffer;
    const iv = crypto.randomBytes(12); // GCM uchun 96-bit IV tavsiya etiladi
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${this.currentVersion}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
  }

  decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 4 || !VERSION_RE.test(parts[0])) {
      throw new Error("Shifrlangan qiymat formati noto'g'ri");
    }
    const [version, ivB64, tagB64, ctB64] = parts;

    // Versiya -> kalit ANIQ moslik. Noma'lum versiya = mos kalit yo'q
    // (masalan rotatsiya tugagach eski kalit olib tashlangan, lekin
    // qaerdadir eski yozuv qolib ketgan) -> ANIQ xato, jim muvaffaqiyat emas.
    const key = this.keyring.get(version);
    if (!key) {
      throw new Error(
        `Shifrmatn "${version}" kalit versiyasini talab qiladi, lekin u sozlanmagan ` +
          '(ENCRYPTION_KEY_PREVIOUS kerak bo\'lishi mumkin).',
      );
    }

    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  /**
   * Qiymat SHU servis formatida shifrlanganmi (legacy plaintext'dan ajratish).
   *
   * SEC-14: tekshiruv KALITDAN MUSTAQIL — faqat SHAKL. Agar bu metod
   * "kalitim bormi" deb tekshirsa, noma'lum versiyali shifrmatn `false`
   * qaytarardi va `decryptString`/`decryptJson` uni PLAINTEXT deb
   * tashqariga qaytarardi. Ya'ni shifrmatn "sir" sifatida chiqib ketardi.
   */
  isEncrypted(v: unknown): v is string {
    return typeof v === 'string' && CIPHERTEXT_PREFIX_RE.test(v) && v.split(':').length === 4;
  }

  /** Qiymat JORIY kalit versiyasida shifrlanganmi (rotatsiya skripti uchun). */
  isCurrentVersion(v: unknown): boolean {
    return typeof v === 'string' && v.startsWith(`${this.currentVersion}:`);
  }

  /**
   * Rotatsiya holati — FAQAT versiya teglari, hech qanday kalit materiali
   * emas. Log/observability uchun xavfsiz.
   */
  keyringStatus(): { currentVersion: string; previousVersion: string | null; versions: string[] } {
    return {
      currentVersion: this.currentVersion,
      previousVersion: this.previousVersion,
      versions: [...this.keyring.keys()],
    };
  }

  /** Obyektni JSON qilib shifrlaydi (connector config uchun). */
  encryptJson(value: unknown): string {
    return this.encrypt(JSON.stringify(value ?? null));
  }

  /** Legacy-compat: shifrlanmagan (eski plaintext obyekt) bo'lsa o'zini qaytaradi. */
  decryptJson<T = Record<string, any>>(stored: unknown): T {
    if (this.isEncrypted(stored)) return JSON.parse(this.decrypt(stored)) as T;
    return (stored ?? {}) as T;
  }

  /** Legacy-compat: 2FA kabi string maydonlar uchun (null-safe). */
  decryptString(stored: string | null | undefined): string | null {
    if (stored == null) return null;
    return this.isEncrypted(stored) ? this.decrypt(stored) : stored;
  }
}

/** Xom kalit materialidan 32 baytli AES-256 kaliti. */
function deriveKey(raw: string): Buffer {
  // 64 hex belgi = 32 bayt (to'g'ridan-to'g'ri); aks holda sha256 orqali
  // barqaror 32 baytga keltiramiz (ixtiyoriy uzunlikdagi parolni qabul qiladi).
  return /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : crypto.createHash('sha256').update(raw).digest();
}

/** Versiya tegini o'qiydi va formatini tekshiradi. */
function readVersion(envKey: string, fallback: string): string {
  const raw = process.env[envKey]?.trim();
  if (!raw) return fallback;
  if (!VERSION_RE.test(raw)) {
    throw new Error(`${envKey} formati noto'g'ri (kutilgan: v1, v2, ...)`);
  }
  return raw;
}
