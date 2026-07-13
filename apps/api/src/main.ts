import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
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

  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  // CORS — dev'da har qanday localhost porti (3000 real app, 3100 preview, ...),
  // prod'da faqat aniq belgilangan origin. Login fetch shu ro'yxatdan o'tadi.
  const explicitOrigin = process.env.NEXT_PUBLIC_APP_URL;
  const isProd = process.env.NODE_ENV === 'production';
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
