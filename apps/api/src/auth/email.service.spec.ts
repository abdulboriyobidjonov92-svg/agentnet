import { EmailService } from './email.service';

/**
 * 2026-08-13 — Gmail SMTP zaxira provayderi.
 *
 * Bu testlar HAQIQIY email YUBORMAYDI: ular faqat PROVAYDER TANLASH
 * mantiqini va probe-manzil qorovulini qulflaydi. Yuborishning o'zi
 * tashqi xizmat — u integratsiya darajasida tekshiriladi.
 */
const gmail = { GMAIL_USER: 'a@gmail.com', GMAIL_APP_PASSWORD: 'x'.repeat(16) };
const resend = { RESEND_API_KEY: 're_test_key' };

const make = (env: Record<string, string | undefined>) => new EmailService(env as NodeJS.ProcessEnv);

describe('EmailService — provayder tanlash', () => {
  it('hech narsa sozlanmagan -> none', () => {
    expect(make({}).activeProvider()).toBe('none');
  });

  it('faqat Gmail sozlangan -> gmail', () => {
    expect(make({ ...gmail }).activeProvider()).toBe('gmail');
  });

  it('faqat Resend sozlangan -> resend', () => {
    expect(make({ ...resend }).activeProvider()).toBe('resend');
  });

  it('IKKALASI ham sozlangan, EMAIL_PROVIDER berilmagan -> gmail (default)', () => {
    // Talab: Resend domeni tasdiqlanmaguncha Gmail ustun bo'lsin.
    expect(make({ ...gmail, ...resend }).activeProvider()).toBe('gmail');
  });

  it('EMAIL_PROVIDER=resend ANIQ berilsa -> resend (Gmail bor bo`lsa ham)', () => {
    expect(make({ ...gmail, ...resend, EMAIL_PROVIDER: 'resend' }).activeProvider()).toBe('resend');
  });

  it('EMAIL_PROVIDER=gmail ANIQ berilsa -> gmail', () => {
    expect(make({ ...gmail, ...resend, EMAIL_PROVIDER: 'gmail' }).activeProvider()).toBe('gmail');
  });

  it('ANIQ so`ralgan provayder sozlanmagan bo`lsa -> none (JIMGINA boshqasiga o`tmaydi)', () => {
    // Muhim: `EMAIL_PROVIDER=resend` deb yozib, kalitni unutgan operator
    // "nega Gmail'dan ketyapti?" degan jumboqqa duch kelmasligi kerak.
    expect(make({ ...gmail, EMAIL_PROVIDER: 'resend' }).activeProvider()).toBe('none');
  });
});

describe('EmailService — probe manzillari (RFC 2606)', () => {
  it('@example.com ga email YUBORILMAYDI va xato ham bermaydi', async () => {
    const svc = make({ ...gmail });
    // Provayder gmail, lekin probe qorovuli undan OLDIN ishlaydi —
    // shuning uchun SMTP umuman chaqirilmaydi va istisno bo'lmaydi.
    await expect(svc.sendOtpCode('probe@example.com', '123456')).resolves.toBeUndefined();
  });

  it('oddiy manzil probe deb hisoblanmaydi', async () => {
    // Provayder sozlanmagan + NODE_ENV=test -> dev tarmog'i (log), istisno yo'q.
    const svc = make({ NODE_ENV: 'test' });
    await expect(svc.sendOtpCode('real@gmail.com', '123456')).resolves.toBeUndefined();
  });

  it('provayder sozlanmagan va PROD bo`lsa -> 503 (fail-closed)', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const svc = make({});
      await expect(svc.sendOtpCode('real@gmail.com', '123456')).rejects.toMatchObject({
        response: { reason: 'email_provider_unconfigured' },
      });
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
