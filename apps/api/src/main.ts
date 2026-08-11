import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { Logger as PinoLogger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { installEngineAuthInterceptor } from './common/engine-auth';
import { validateEnv } from './common/validate-env';
import { installBigIntJsonSerializer } from './common/bigint-serialize';
import { apiSecurityHeaders } from './common/security-headers';
import { initSentry } from './observability/sentry';
import { requestIdMiddleware } from './observability/request-id.middleware';

async function bootstrap() {
  // A13: pul ustunlari BigInt — JSON.stringify(BigInt) sukut bo'yicha
  // TypeError tashlaydi. Patch HAR NARSADAN OLDIN o'rnatiladi, aks holda
  // boot paytidagi birinchi xato-log ham yiqilishi mumkin.
  installBigIntJsonSerializer();

  // Phase 5 (P5.1): Sentry HAMMASIDAN OLDIN — boot paytidagi xatolar
  // (validateEnv'dan keyingi modul konstruktorlari) ham qamrab olinsin.
  // `SENTRY_DSN` yo'q bo'lsa hech narsa qilmaydi (no-op SDK).
  initSentry();

  // Konfiguratsiya tekshiruvi — prod'da majburiy env yetishmasa aniq ro'yxat
  // bilan fail-fast (sirli mid-construction crash o'rniga).
  validateEnv();

  // agent-engine endi ichki token talab qiladi — barcha engine chaqiruvlariga
  // `x-internal-token` qo'shadigan yagona axios interceptor'ni o'rnatamiz.
  installEngineAuthInterceptor();

  // SEC-08: bodyParser: false — Nest'ning avtomatik (limitsiz-ga yaqin,
  // framework-standart) body-parser'ini o'chiramiz, pastda O'ZIMIZ aniq
  // 1MB limit bilan o'rnatamiz.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Phase 5 (P5.2): boot paytidagi loglar pino tayyor bo'lguncha
    // buferlanadi va keyin AYNI formatda chiqadi — aks holda boot
    // xabarlari matn, qolgani JSON bo'lib, log agregatori boot'ni
    // umuman ko'rmasdi.
    bufferLogs: true,
    bodyParser: false,
  });

  // Phase 5 (P5.2): Nest'ning standart matnli logger'i pino bilan
  // ALMASHTIRILADI. Mavjud `new Logger(...)` chaqiruvlari (biznes va
  // xavfsizlik loglari) O'ZGARMAYDI — faqat chiqish formati JSON bo'ladi.
  app.useLogger(app.get(PinoLogger));

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
  // Xavfsizlik sarlavhalari (M7 + SEC-13) — helmet paketisiz. API HTML
  // bermaydi, shuning uchun to'plam qisqa va QATTIQ: MIME-sniffing va
  // clickjacking'ni to'sish, referrer'ni yashirish, X-Powered-By'ni olib
  // tashlash, prod'da HSTS va SEC-13 dan beri `default-src 'none'` CSP.
  // Helmet KIRITILMADI: mavjud to'plam yetarli va u yangi bog'liqlik
  // hamda ikkinchi (ziddiyatli) siyosat manbaini keltirardi.
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // Phase 5 (P5.3): request-id — ilgari shu joyda 3 qatorlik, TEKSHIRUVSIZ
  // blok bor edi (mijoz istalgan uzunlik/belgidagi qiymat yubora olardi).
  // Endi u `observability/request-id.middleware.ts` ga ko'chdi: qat'iy
  // format, ALS konteksti (engine propagatsiyasi uchun) va testlar bilan.
  // MODULLARDAN OLDIN turadi — pino `genReqId` shu qiymatni ko'radi.
  app.use(requestIdMiddleware());

  app.use((req: any, res: any, next: () => void) => {
    // SEC-13: sarlavhalar to'plami `common/security-headers.ts` da
    // (testlanadigan, yagona manba). Swagger yo'lida CSP tushib qoladi —
    // sabab o'sha faylda.
    const headers = apiSecurityHeaders({
      isProd,
      path: req.originalUrl ?? req.url ?? '',
    });
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
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
  // Phase 5 (P5.2): `console.log` o'rniga strukturaviy log — boot
  // xabari ham agregatorda qidiriladigan JSON bo'lsin.
  app.get(PinoLogger).log(`API tinglayapti: port ${process.env.PORT ?? 3001}`);
}

bootstrap();
