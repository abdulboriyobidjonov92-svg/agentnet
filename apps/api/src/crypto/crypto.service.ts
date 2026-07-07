import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * At-rest shifrlash — AES-256-GCM (autentifikatsiyalangan shifr).
 *
 * Maqsad: DB'da ochiq saqlanmasligi kerak bo'lgan maxfiy ma'lumotlar —
 * connector tokenlari (telegram/whatsapp/SMS/SMTP/CRM), 2FA TOTP sirlari.
 * DB dampi o'g'irlansa ham, kalit (ENCRYPTION_KEY) alohida bo'lgani uchun
 * sirlar ochilmaydi.
 *
 * Format (versiyalangan — kelajakda kalit rotatsiyasi uchun):
 *   v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>
 *
 * Orqaga-moslik: `decrypt*` metodlari `v1:` prefiksi bo'lmagan (eski,
 * shifrlanmagan) qiymatni o'zini qaytaradi — mavjud plaintext yozuvlar
 * migratsiyasiz ishlaydi va keyingi yozuvda avtomatik shifrlanadi.
 */

const VERSION = 'v1';
const ALGO = 'aes-256-gcm';
const DEV_KEY_SEED = 'agentnet-dev-encryption-key-do-not-use-in-prod';

@Injectable()
export class CryptoService {
  private readonly key: Buffer;
  private readonly logger = new Logger('CryptoService');

  constructor() {
    const raw = process.env.ENCRYPTION_KEY;
    const isProd = process.env.NODE_ENV === 'production';

    if (raw && raw.trim()) {
      // 64 hex belgi = 32 bayt (to'g'ridan-to'g'ri); aks holda sha256 orqali
      // barqaror 32 baytga keltiramiz (ixtiyoriy uzunlikdagi parolni qabul qiladi).
      this.key = /^[0-9a-fA-F]{64}$/.test(raw.trim())
        ? Buffer.from(raw.trim(), 'hex')
        : crypto.createHash('sha256').update(raw).digest();
    } else if (isProd) {
      // Prod'da kalitsiz ishga tushmaydi — sirlar himoyasiz qolmasligi uchun.
      throw new Error(
        'ENCRYPTION_KEY production uchun SHART (at-rest AES-256-GCM shifrlash). ' +
          '`openssl rand -hex 32` bilan yarating.',
      );
    } else {
      // Dev: barqaror derivativ kalit — restartlar orasida round-trip ishlaydi.
      this.key = crypto.createHash('sha256').update(DEV_KEY_SEED).digest();
      this.logger.warn(
        'ENCRYPTION_KEY sozlanmagan — DEV derivativ kalit ishlatilmoqda. Prod uchun SHART.',
      );
    }
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12); // GCM uchun 96-bit IV tavsiya etiladi
    const cipher = crypto.createCipheriv(ALGO, this.key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
  }

  decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 4 || parts[0] !== VERSION) {
      throw new Error("Shifrlangan qiymat formati noto'g'ri");
    }
    const [, ivB64, tagB64, ctB64] = parts;
    const decipher = crypto.createDecipheriv(ALGO, this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  /** Qiymat shu servis bilan shifrlanganmi (v1: prefiksli). Legacy'ni ajratish uchun. */
  isEncrypted(v: unknown): v is string {
    return typeof v === 'string' && v.startsWith(`${VERSION}:`);
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
