import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { installEngineAuthInterceptor } from './common/engine-auth';
import { validateEnv } from './common/validate-env';

async function bootstrap() {
  // Konfiguratsiya tekshiruvi — prod'da majburiy env yetishmasa aniq ro'yxat
  // bilan fail-fast (sirli mid-construction crash o'rniga).
  validateEnv();

  // agent-engine endi ichki token talab qiladi — barcha engine chaqiruvlariga
  // `x-internal-token` qo'shadigan yagona axios interceptor'ni o'rnatamiz.
  installEngineAuthInterceptor();

  // rawBody: true — svix (Clerk webhook) imzo tekshiruvi XOM baytlar ustida
  // ishlashi shart. Busiz @Body() parsed-JSON obyekt beradi va imzo tekshiruvi
  // HAR DOIM yiqilar edi (auth.controller'dagi req.rawBody shunga tayanadi).
  const app = await NestFactory.create(AppModule, { bufferLogs: false, rawBody: true });

  const explicitOrigin = process.env.NEXT_PUBLIC_APP_URL;
  const isProd = process.env.NODE_ENV === 'production';

  // TRUST PROXY (kritik) — Render/reverse-proxy ortida `req.ip` aks holda HAR
  // DOIM proxy IP'sini qaytaradi → ThrottlerGuard VA @Throttle (OTP/login
  // rate-limit) BARCHA foydalanuvchilarni BITTA IP-bucket'ga soladi: bitta
  // odam limitni yoqsa hamma bloklanadi (launch kuni login butunlay sinadi).
  // Bir hop (`1`) — Render'ning yagona proxy qatlami; `true` X-Forwarded-For
  // spoofing'ga yo'l ochardi, shuning uchun aniq son. Faqat prod'da (dev'da
  // to'g'ridan-to'g'ri ulanish, proxy yo'q).
  if (isProd) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }
  // Ruxsat etilgan origin'lar. NEXT_PUBLIC_APP_URL vergul bilan bir nechta
  // qiymat qabul qiladi (masalan asosiy domen + eski domen).
  const allowedOrigins = (explicitOrigin ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, '')) // oxiridagi '/' ni olib tashlaymiz
    .filter(Boolean);

  // Vercel/preview deploy'lari HAR safar yangi tasodifiy subdomen oladi
  // (agentnet-<hash>-<team>.vercel.app), shuning uchun ularni aniq ro'yxatga
  // yozib bo'lmaydi. CORS_ORIGIN_SUFFIXES — vergul bilan ajratilgan SUFFIKS
  // ro'yxati (masalan "-svgs-projects.vercel.app"). Suffiks o'z jamoangizga
  // xos bo'lishi SHART — ".vercel.app" kabi umumiy qiymat butun Vercel'ni
  // ochib yuboradi, shuning uchun bunday kengligi tekshiriladi va rad etiladi.
  const originSuffixes = (process.env.CORS_ORIGIN_SUFFIXES ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => {
      if (!s) return false;
      // Xavfsizlik: juda keng suffikslar (butun .vercel.app / .com va h.k.) taqiqlanadi.
      const tooBroad = /^\.?(vercel\.app|netlify\.app|fly\.dev|com|net|org|app|io)$/.test(
        s.replace(/^\./, ''),
      );
      if (tooBroad) {
        new Logger('Bootstrap').error(
          `CORS_ORIGIN_SUFFIXES: "${s}" juda keng — e'tiborsiz qoldirildi. ` +
            `Jamoangizga xos suffiks bering (masalan "-mening-jamoam.vercel.app").`,
        );
        return false;
      }
      return true;
    });

  app.enableCors({
    origin: (origin, callback) => {
      // Server-to-server yoki curl (origin yo'q) — ruxsat
      if (!origin) return callback(null, true);
      const clean = origin.replace(/\/+$/, '');
      // Localhost (har qanday port) — FAQAT dev'da. Prod'da faqat aniq
      // belgilangan origin (credentials:true bilan localhost'ni ochiq qoldirmaslik uchun).
      const isLocalhost = !isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(clean);
      const isAllowedExact = allowedOrigins.includes(clean);
      // Suffiks mosligi faqat https origin'lar uchun (http preview yo'q).
      const isAllowedSuffix =
        clean.startsWith('https://') &&
        originSuffixes.some((suffix) => clean.toLowerCase().endsWith(suffix));

      if (isLocalhost || isAllowedExact || isAllowedSuffix) return callback(null, true);
      return callback(new Error(`CORS: ${origin} ruxsat etilmagan`), false);
    },
    credentials: true,
  });
  // Xavfsizlik sarlavhalari (M7) — helmet paketisiz, minimal to'plam. API HTML
  // bermaydi, shuning uchun eng muhimlari: MIME-sniffing va clickjacking'ni
  // to'sish, referrer'ni yashirish, X-Powered-By'ni olib tashlash, prod'da HSTS.
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use((req: any, res: any, next: () => void) => {
    // Request-id — xato-loglarni bitta so'rov bo'yicha kuzatish uchun (observability).
    const reqId = req.headers['x-request-id'] || randomUUID();
    req.headers['x-request-id'] = reqId;
    res.setHeader('X-Request-Id', reqId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    if (isProd) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    next();
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Swagger (/api/docs) — FAQAT dev'da (M7). Ilgari prod'da ham ochiq edi va
  // render healthCheckPath ham shunga ishora qilardi (to'liq API sxemasini
  // oshkor qilardi). Endi healthcheck /api/health'ga o'tdi, Swagger prod'da yopiq.
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AgentNet API')
      .setDescription('AgentNet (Baraka AI) — Core SaaS API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  await app.listen(process.env.PORT ?? 3001);
  console.log(`API running on http://localhost:${process.env.PORT ?? 3001}`);
}

bootstrap();
