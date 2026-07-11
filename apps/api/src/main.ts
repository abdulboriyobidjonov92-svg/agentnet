import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AgentNet API')
    .setDescription('AgentNet (Baraka AI) — Core SaaS API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(process.env.PORT ?? 3001);
  console.log(`API running on http://localhost:${process.env.PORT ?? 3001}`);
}

bootstrap();
