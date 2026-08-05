import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import * as express from 'express';
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
  //
  // SEC-08: bodyParser: false — Nest'ning avtomatik (limitsiz-ga yaqin,
  // framework-standart) body-parser'ini o'chiramiz, pastda O'ZIMIZ aniq
  // 1MB limit bilan o'rnatamiz (useBodyParser — rawBody:true'ni hali ham
  // hurmat qiladi, chunki u appOptions'dan o'qiydi).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
    rawBody: true,
    bodyParser: false,
  });

  // SEC-08 AC: global JSON limiti 1MB. `/device/recordings` (qo'ng'iroq
  // yozuvi — base64 audio) BUNDAN OLDIN, kengroq (10MB) limit bilan alohida
  // ro'yxatdan o'tadi — Express so'rovni BIRINCHI mos middleware'da
  // parslaydi, keyingi global 1MB parser shu yo'lda ishlamay qoladi (body
  // allaqachon o'qilgan). To'liq R2 presigned-URL multipart yo'li (AC'ning
  // muqobil varianti) ATAYLAB qurilmagan — bu yangi infratuzilma (R2 SDK,
  // presigned-URL endpoint, frontend yuklash oqimi) talab qiladi, "1 ED"
  // vazifa doirasidan tashqari; AC o'zi "10MB" ni aniq muqobil sifatida beradi.
  app.use('/api/device/recordings', express.json({ limit: '10mb' }));
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

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
  app.enableCors({
    origin: (origin, callback) => {
      // Server-to-server yoki curl (origin yo'q) — ruxsat
      if (!origin) return callback(null, true);
      // Localhost (har qanday port) — FAQAT dev'da. Prod'da faqat aniq
      // belgilangan origin (credentials:true bilan localhost'ni ochiq qoldirmaslik uchun).
      const isLocalhost = !isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (isLocalhost || (explicitOrigin && origin === explicitOrigin)) return callback(null, true);
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
