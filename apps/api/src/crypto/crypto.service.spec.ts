import { CryptoService } from './crypto.service';

describe('CryptoService (AES-256-GCM at-rest shifrlash)', () => {
  const KEY = '6fd9c43e918e28642191cd2ca359763b10c9a04b9e06e8d3a992389b3e01944f';
  let crypto: CryptoService;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = KEY;
    process.env.NODE_ENV = 'test';
    crypto = new CryptoService();
  });

  it('string round-trip: encrypt -> decrypt asl matnni qaytaradi', () => {
    const ct = crypto.encrypt('my-totp-secret-ABC123');
    expect(crypto.decrypt(ct)).toBe('my-totp-secret-ABC123');
  });

  it('format v1:iv:tag:ct (4 qism)', () => {
    const ct = crypto.encrypt('x');
    expect(ct.startsWith('v1:')).toBe(true);
    expect(ct.split(':')).toHaveLength(4);
  });

  it('har chaqiruvda IV boshqa (bir xil matn -> boshqa shifrmatn)', () => {
    expect(crypto.encrypt('same')).not.toBe(crypto.encrypt('same'));
  });

  it('JSON round-trip (connector config)', () => {
    const cfg = { bot_token: '123:AA-secret', chat_id: '999', nested: { k: [1, 2] } };
    const enc = crypto.encryptJson(cfg);
    expect(crypto.isEncrypted(enc)).toBe(true);
    expect(crypto.decryptJson(enc)).toEqual(cfg);
  });

  it('legacy plaintext obyekt o\'zini qaytaradi (migratsiyasiz orqaga-moslik)', () => {
    expect(crypto.decryptJson({ old: 'plain' })).toEqual({ old: 'plain' });
    expect(crypto.decryptJson(null)).toEqual({});
  });

  it('decryptString: legacy plaintext, null, shifrlangan', () => {
    expect(crypto.decryptString('old-plain-secret')).toBe('old-plain-secret');
    expect(crypto.decryptString(null)).toBeNull();
    expect(crypto.decryptString(crypto.encrypt('sekret'))).toBe('sekret');
  });

  it('buzilgan shifrmatn rad etiladi (GCM auth tag)', () => {
    const parts = crypto.encrypt('protected').split(':');
    const ctBuf = Buffer.from(parts[3], 'base64');
    ctBuf[0] ^= 0x01; // 1 bit flip
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${ctBuf.toString('base64')}`;
    expect(() => crypto.decrypt(tampered)).toThrow();
  });

  it('noto\'g\'ri kalit bilan deshifrlab bo\'lmaydi', () => {
    const ct = crypto.encrypt('secret');
    process.env.ENCRYPTION_KEY = '0'.repeat(64);
    const other = new CryptoService();
    expect(() => other.decrypt(ct)).toThrow();
  });

  it('PROD + ENCRYPTION_KEY yo\'q -> fail-closed (construct xato beradi)', () => {
    const prev = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    process.env.NODE_ENV = 'production';
    expect(() => new CryptoService()).toThrow(/ENCRYPTION_KEY/);
    process.env.ENCRYPTION_KEY = prev;
    process.env.NODE_ENV = 'test';
  });
});
