import * as nodeCrypto from 'crypto';
import { CryptoService } from './crypto.service';

/**
 * SEC-14 — kalit versiyalash va rotatsiya xavfsizligi.
 *
 * HAQIQIY kripto ishlatiladi (mock YO'Q) — bu testlar aynan AES-256-GCM
 * xulqini va kalit-tanlash mantig'ini qulflaydi.
 *
 * Kalitlar test ichida GENERATSIYA qilinadi (kodga yozib qo'yilmaydi) —
 * shu bilan gitleaks uchun ham soxta "sir" qolmaydi.
 */

const OLD_KEY = nodeCrypto.randomBytes(32).toString('hex');
const NEW_KEY = nodeCrypto.randomBytes(32).toString('hex');

/** Env'ni aniq holatga qo'yib, yangi servis quradi. */
function makeService(env: Record<string, string | undefined>): CryptoService {
  const keys = [
    'ENCRYPTION_KEY',
    'ENCRYPTION_KEY_VERSION',
    'ENCRYPTION_KEY_PREVIOUS',
    'ENCRYPTION_KEY_PREVIOUS_VERSION',
  ];
  for (const k of keys) delete process.env[k];
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
  return new CryptoService();
}

/** Rotatsiyagacha: bitta kalit, versiya `v1` (bugungi prod holati). */
const beforeRotation = () => makeService({ ENCRYPTION_KEY: OLD_KEY });

/** Rotatsiya oynasi: yozish `v2` (yangi kalit), o'qish `v1`+`v2`. */
const duringRotation = () =>
  makeService({
    ENCRYPTION_KEY: NEW_KEY,
    ENCRYPTION_KEY_VERSION: 'v2',
    ENCRYPTION_KEY_PREVIOUS: OLD_KEY,
    ENCRYPTION_KEY_PREVIOUS_VERSION: 'v1',
  });

/** Rotatsiyadan keyin: eski kalit OLIB TASHLANGAN. */
const afterRotation = () =>
  makeService({ ENCRYPTION_KEY: NEW_KEY, ENCRYPTION_KEY_VERSION: 'v2' });

beforeEach(() => {
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  for (const k of [
    'ENCRYPTION_KEY',
    'ENCRYPTION_KEY_VERSION',
    'ENCRYPTION_KEY_PREVIOUS',
    'ENCRYPTION_KEY_PREVIOUS_VERSION',
  ]) {
    delete process.env[k];
  }
  process.env.NODE_ENV = 'test';
});

// ----------------------------------------------------------------
// Kalit konfiguratsiyasi
// ----------------------------------------------------------------
describe('SEC-14 — kalit konfiguratsiyasi', () => {
  it('default versiya `v1` — mavjud .env HECH QANDAY o\'zgarishsiz ishlaydi', () => {
    const svc = beforeRotation();
    expect(svc.keyringStatus()).toEqual({
      currentVersion: 'v1',
      previousVersion: null,
      versions: ['v1'],
    });
    expect(svc.encrypt('x').startsWith('v1:')).toBe(true);
  });

  it('rotatsiya rejimida IKKALA versiya ham o\'qiladi, yozish faqat joriy', () => {
    const svc = duringRotation();
    const status = svc.keyringStatus();
    expect(status.currentVersion).toBe('v2');
    expect(status.previousVersion).toBe('v1');
    expect(status.versions.sort()).toEqual(['v1', 'v2']);
    expect(svc.encrypt('x').startsWith('v2:')).toBe(true);
  });

  it('keyringStatus KALIT MATERIALINI oshkor qilmaydi', () => {
    const serialized = JSON.stringify(duringRotation().keyringStatus());
    expect(serialized).not.toContain(OLD_KEY);
    expect(serialized).not.toContain(NEW_KEY);
  });

  it('YARIM konfiguratsiya rad etiladi (kalit bor, versiya yo\'q)', () => {
    expect(() =>
      makeService({ ENCRYPTION_KEY: NEW_KEY, ENCRYPTION_KEY_PREVIOUS: OLD_KEY }),
    ).toThrow(/BIRGA/);
  });

  it('YARIM konfiguratsiya rad etiladi (versiya bor, kalit yo\'q)', () => {
    expect(() =>
      makeService({ ENCRYPTION_KEY: NEW_KEY, ENCRYPTION_KEY_PREVIOUS_VERSION: 'v1' }),
    ).toThrow(/BIRGA/);
  });

  it('oldingi versiya joriy bilan BIR XIL bo\'lsa rad etiladi', () => {
    expect(() =>
      makeService({
        ENCRYPTION_KEY: NEW_KEY,
        ENCRYPTION_KEY_VERSION: 'v1',
        ENCRYPTION_KEY_PREVIOUS: OLD_KEY,
        ENCRYPTION_KEY_PREVIOUS_VERSION: 'v1',
      }),
    ).toThrow(/bir xil/);
  });

  it('noto\'g\'ri versiya formati rad etiladi', () => {
    expect(() => makeService({ ENCRYPTION_KEY: NEW_KEY, ENCRYPTION_KEY_VERSION: 'latest' })).toThrow(
      /formati/,
    );
  });

  it('PROD: kalitsiz boot BO\'LMAYDI', () => {
    process.env.NODE_ENV = 'production';
    expect(() => makeService({})).toThrow(/ENCRYPTION_KEY/);
    process.env.NODE_ENV = 'test';
  });

  it('PROD: juda qisqa (zaif) kalit rad etiladi — xato matnida kalit YO\'Q', () => {
    process.env.NODE_ENV = 'production';
    try {
      makeService({ ENCRYPTION_KEY: 'short-key-123' });
      throw new Error('kutilgan xato yuz bermadi');
    } catch (e) {
      expect((e as Error).message).toMatch(/qisqa/);
      expect((e as Error).message).not.toContain('short-key-123');
    }
    process.env.NODE_ENV = 'test';
  });

  it('PROD: Render `generateValue` uslubidagi uzun kalit QABUL qilinadi', () => {
    process.env.NODE_ENV = 'production';
    const renderStyle = nodeCrypto.randomBytes(32).toString('base64');
    expect(() => makeService({ ENCRYPTION_KEY: renderStyle })).not.toThrow();
    process.env.NODE_ENV = 'test';
  });
});

// ----------------------------------------------------------------
// Orqaga-moslik va versiya bo'yicha kalit tanlash
// ----------------------------------------------------------------
describe('SEC-14 — v1/v2 moslik', () => {
  it('v1 shifrmatn rotatsiya oynasida ESKI kalit bilan o\'qiladi', () => {
    const v1 = beforeRotation().encrypt('legacy-secret');
    expect(duringRotation().decrypt(v1)).toBe('legacy-secret');
  });

  it('v2 shifrmatn YANGI kalit bilan o\'qiladi', () => {
    const during = duringRotation();
    const v2 = during.encrypt('fresh-secret');
    expect(v2.startsWith('v2:')).toBe(true);
    expect(during.decrypt(v2)).toBe('fresh-secret');
    expect(afterRotation().decrypt(v2)).toBe('fresh-secret');
  });

  it('ARALASH baza (v1 + v2) rotatsiya oynasida TO\'LIQ o\'qiladi', () => {
    const v1 = beforeRotation().encrypt('old-row');
    const during = duringRotation();
    const v2 = during.encrypt('new-row');
    expect(during.decrypt(v1)).toBe('old-row');
    expect(during.decrypt(v2)).toBe('new-row');
  });

  it('rotatsiyadan KEYIN qolib ketgan v1 yozuvi ANIQ xato beradi (jim emas)', () => {
    const v1 = beforeRotation().encrypt('orphan');
    expect(() => afterRotation().decrypt(v1)).toThrow(/v1.*sozlanmagan|sozlanmagan/);
  });

  it('legacy PLAINTEXT (shifrlanmagan) qiymat o\'zini qaytaradi', () => {
    const svc = duringRotation();
    expect(svc.decryptString('plain-legacy')).toBe('plain-legacy');
    expect(svc.decryptJson({ a: 1 })).toEqual({ a: 1 });
  });

  it('NOMA\'LUM versiyali blob PLAINTEXT deb qaytarilmaydi (fail-closed)', () => {
    // Eng muhim regressiya: `isEncrypted` faqat SHAKLGA qaraydi, kalitga
    // emas. Aks holda v9 blob "sir" sifatida tashqariga chiqib ketardi.
    const svc = duringRotation();
    const v9 = `v9:${Buffer.from('iv').toString('base64')}:${Buffer.from('tag').toString('base64')}:${Buffer.from('ct').toString('base64')}`;
    expect(svc.isEncrypted(v9)).toBe(true);
    expect(() => svc.decryptString(v9)).toThrow();
  });
});

// ----------------------------------------------------------------
// Kripto xavfsizligi
// ----------------------------------------------------------------
describe('SEC-14 — kripto xavfsizligi', () => {
  it('NOTO\'G\'RI kalit bilan deshifrlab bo\'lmaydi (GCM auth)', () => {
    const v2 = duringRotation().encrypt('secret');
    const wrong = makeService({
      ENCRYPTION_KEY: nodeCrypto.randomBytes(32).toString('hex'),
      ENCRYPTION_KEY_VERSION: 'v2',
    });
    expect(() => wrong.decrypt(v2)).toThrow();
  });

  it('BUZILGAN shifrmatn rad etiladi (auth tag)', () => {
    const svc = duringRotation();
    const parts = svc.encrypt('protected').split(':');
    const buf = Buffer.from(parts[3], 'base64');
    buf[0] ^= 0x01;
    expect(() => svc.decrypt(`${parts[0]}:${parts[1]}:${parts[2]}:${buf.toString('base64')}`)).toThrow();
  });

  it('VERSIYA tegini almashtirish kalit-chalkashligi bermaydi', () => {
    // Hujumchi v1 blobni "v2" deb belgilasa — u YANGI kalit bilan
    // autentifikatsiyadan o'tishi kerak bo'ladi va yiqiladi.
    const v1 = beforeRotation().encrypt('secret');
    const forged = v1.replace(/^v1:/, 'v2:');
    expect(() => duringRotation().decrypt(forged)).toThrow();
  });

  it('har shifrlashda IV boshqa', () => {
    const svc = duringRotation();
    expect(svc.encrypt('same')).not.toBe(svc.encrypt('same'));
  });

  it('rotatsiya ochiq matnni O\'ZGARTIRMAYDI (JSON konfiguratsiya)', () => {
    const cfg = { bot_token: 'abc:123', nested: { list: [1, 2, 3] }, empty: null };
    const v1 = beforeRotation().encryptJson(cfg);
    const during = duringRotation();
    const rotated = during.encrypt(during.decrypt(v1)); // skript aynan shuni qiladi
    expect(rotated.startsWith('v2:')).toBe(true);
    expect(during.decryptJson(rotated)).toEqual(cfg);
  });

  it('IDEMPOTENTLIK: joriy versiyadagi yozuv qayta shifrlanmaydi', () => {
    const during = duringRotation();
    const v2 = during.encrypt('already-rotated');
    expect(during.isCurrentVersion(v2)).toBe(true);
    // Skript `isCurrentVersion` bo'yicha o'tkazib yuboradi -> ikkinchi
    // ishga tushirish yozuvni buzmaydi.
    expect(during.decrypt(v2)).toBe('already-rotated');
  });

  it('UZILGAN rotatsiya: yarim ko\'chirilgan baza TO\'LIQ o\'qiladi', () => {
    const before = beforeRotation();
    const notRotated = before.encrypt('row-a');
    const during = duringRotation();
    const rotated = during.encrypt(during.decrypt(before.encrypt('row-b')));

    // Jarayon shu yerda uzildi. Ilova ikkalasini ham o'qiy oladi:
    expect(during.decrypt(notRotated)).toBe('row-a');
    expect(during.decrypt(rotated)).toBe('row-b');
  });
});
