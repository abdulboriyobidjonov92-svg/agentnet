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

  // Kamida BITTA login-kanali bo'lishi shart (email YOKI telefon), aks holda
  // hech kim kira olmaydi. Email = Resend, Telefon = Eskiz.
  const emailChannel = has('RESEND_API_KEY');
  const phoneChannel = has('ESKIZ_EMAIL') && has('ESKIZ_PASSWORD');
  const noLoginChannel = !emailChannel && !phoneChannel;

  if (isProd && (missing.length || noLoginChannel)) {
    logger.error('════════════════════════════════════════════════════════');
    logger.error('PROD BOOT TO\'XTATILDI — konfiguratsiya to\'liq emas:');
    for (const m of missing) logger.error(`  ✗ ${m.key} — ${m.why}`);
    if (noLoginChannel) {
      logger.error('  ✗ Login kanali yo\'q — RESEND_API_KEY (email) YOKI');
      logger.error('     ESKIZ_EMAIL+ESKIZ_PASSWORD (telefon) dan kamida bittasi kerak.');
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
  if (!isProd && missing.length) {
    logger.warn(`Dev rejim: ba'zi env yo'q (${missing.map((m) => m.key).join(', ')}) — fallback ishlatiladi.`);
  }
}
