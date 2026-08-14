import { Logger } from '@nestjs/common';

/**
 * Boot'da majburiy env'larni tekshiradi (prod fail-fast). Ilgari bitta yetishmagan
 * sir (masalan RESEND_API_KEY) tushunarsiz mid-construction crash berardi — endi
 * operatorga aynan NIMA yetishmayotganini bitta aniq ro'yxatda aytadi. Bu #1
 * launch-og'rig'ini (chiqarish paytida sirli qulash) hal qiladi.
 *
 * Dev'da yumshoq (faqat ogohlantirish) — mahalliy ishlab chiqish uchun kalit shart emas.
 */
export function validateEnv(): void {
  const logger = new Logger('Bootstrap');
  const isProd = process.env.NODE_ENV === 'production';
  const has = (k: string) => !!process.env[k]?.trim();

  // Har doim majburiy (dev'da ham — lekin dev'da fallback bor, shuning uchun prod-gate).
  const hardRequired: Array<{ key: string; why: string }> = [
    { key: 'DATABASE_URL', why: 'Postgres ulanishi' },
    { key: 'AUTH_JWT_SECRET', why: 'sessiya-token imzosi (render: generateValue)' },
    { key: 'ENCRYPTION_KEY', why: 'at-rest AES-256-GCM shifrlash (render: generateValue)' },
    { key: 'INTERNAL_API_TOKEN', why: 'ichki server-to-server auth (render: umumiy guruh)' },
    { key: 'NEXT_PUBLIC_APP_URL', why: 'CORS origin (brauzer so\'rovlari)' },
    // SEC-10: engine Render'da private service (`type: pserv`) — uning manzili
    // ommaviy URL emas, xususiy tarmoq manzili (`http://<internal-host>:8000`)
    // va uni blueprint oldindan bila olmaydi (Render hostname'ga taxmin
    // qilib bo'lmaydigan qo'shimcha beradi), shuning uchun operator qo'lda
    // kiritadi. Kiritilmasa kodda `http://localhost:8000` fallback'i bor —
    // ya'ni prod JIM ishlamay qolardi (har engine chaqiruvi uzilardi).
    // Shu sababli prod'da bu env MAJBURIY: xato boot'da ko'rinadi, jonli
    // trafikda emas.
    { key: 'AGENT_ENGINE_URL', why: 'engine xususiy tarmoq manzili (SEC-10: pserv, `http://<internal-host>:8000`)' },
  ];

  const missing = hardRequired.filter((r) => !has(r.key));

  /**
   * SEC-14 — prod'da OCHIQ-OYDIN MA'LUM dev qiymatlari taqiqlanadi.
   *
   * `INTERNAL_API_TOKEN` uchun kodda ham, `.env.example` da ham bir xil dev
   * fallback bor (`agentnet-internal-dev`). U ATAYLAB ommaviy — lokal
   * ishlab chiqish uchun. Lekin prod'da o'sha qiymat qolib ketsa, "ichki
   * server-to-server" darvozasi amalda OCHIQ bo'lardi: uni bilgan har kim
   * BFF-only endpointlarni (refund, engine stream) chaqira olardi.
   *
   * `has()` tekshiruvi buni ushlamaydi — qiymat MAVJUD, lekin ma'lum.
   */
  const publiclyKnownDefaults: Array<{ key: string; value: string }> = [
    { key: 'INTERNAL_API_TOKEN', value: 'agentnet-internal-dev' },
  ];
  const weakDefaults = publiclyKnownDefaults.filter(
    (d) => process.env[d.key]?.trim() === d.value,
  );

  // Kamida BITTA login-kanali bo'lishi shart (email YOKI telefon), aks holda
  // hech kim kira olmaydi. Email = Resend, Telefon = Eskiz.
  // 2026-08-13: email kanali endi IKKI provayderdan biri bo'lishi mumkin.
  // Ilgari bu yerda faqat `RESEND_API_KEY` tekshirilardi — ya'ni FAQAT
  // Gmail sozlangan muhitda prod boot "login kanali yo'q" deb QULARDI,
  // holbuki email aslida ishlayotgan bo'lardi.
  const emailChannel = has('RESEND_API_KEY') || (has('GMAIL_USER') && has('GMAIL_APP_PASSWORD'));
  const phoneChannel = has('ESKIZ_EMAIL') && has('ESKIZ_PASSWORD');
  const noLoginChannel = !emailChannel && !phoneChannel;

  if (isProd && (missing.length || noLoginChannel || weakDefaults.length)) {
    logger.error('════════════════════════════════════════════════════════');
    logger.error('PROD BOOT TO\'XTATILDI — konfiguratsiya to\'liq emas:');
    for (const m of missing) logger.error(`  ✗ ${m.key} — ${m.why}`);
    for (const d of weakDefaults) {
      // Qiymatning O'ZI logga yozilmaydi (u ommaviy bo'lsa ham — intizom).
      logger.error(`  ✗ ${d.key} — ommaviy MA'LUM dev qiymati ishlatilmoqda; yangi sir yarating.`);
    }
    if (noLoginChannel) {
      logger.error('  ✗ Login kanali yo\'q — quyidagilardan KAMIDA BITTASI kerak:');
      logger.error('     • RESEND_API_KEY                     (email, Resend)');
      logger.error('     • GMAIL_USER + GMAIL_APP_PASSWORD    (email, Gmail SMTP)');
      logger.error('     • ESKIZ_EMAIL + ESKIZ_PASSWORD       (telefon, SMS)');
    }
    logger.error('Render → servis → Environment\'da to\'ldiring va qayta deploy qiling.');
    logger.error('════════════════════════════════════════════════════════');
    process.exit(1);
  }

  // Ogohlantirish (bloklamaydi) — ixtiyoriy lekin muhim funksiyalar.
  if (!has('ANTHROPIC_API_KEY')) {
    logger.warn('ANTHROPIC_API_KEY yo\'q — LLM demo/heuristik rejimda ishlaydi (real Claude javobi yo\'q).');
  }
  if (!has('PAYME_MERCHANT_ID') && !has('CLICK_SERVICE_ID')) {
    logger.warn('To\'lov provayderi (Payme/Click) sozlanmagan — balans to\'ldirish ishlamaydi.');
  }
  // Ikkalasi ham SHART — bittasi qolib ketsa (masalan operator faqat
  // Client ID'ni kiritib, Secret'ni unutsa) `GoogleOAuthService.isConfigured()`
  // false qaytaradi va tugma "coming soon" bo'lib qolaveradi, sabab esa
  // ko'rinmasdi. Bu yerda ANIQ aytiladi.
  if (has('GOOGLE_CLIENT_ID') !== has('GOOGLE_CLIENT_SECRET')) {
    logger.warn(
      'GOOGLE_CLIENT_ID va GOOGLE_CLIENT_SECRET faqat BITTASI berilgan — Google login sozlanmagan hisoblanadi.',
    );
  }
  if (!isProd && missing.length) {
    logger.warn(`Dev rejim: ba'zi env yo'q (${missing.map((m) => m.key).join(', ')}) — fallback ishlatiladi.`);
  }
}
