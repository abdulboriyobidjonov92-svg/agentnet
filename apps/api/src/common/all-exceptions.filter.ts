import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Global xato-filtri (observability). Ilgari API'da markazlashgan xato-kuzatuv
 * yo'q edi — kutilmagan xatolar noizchil loglanardi va prod'da ko'rinmasdi.
 * Endi HAR bir ishlov berilmagan xato bu yerga tushadi:
 *   • 5xx (kutilmagan) — to'liq stack bilan `error` darajasida loglanadi
 *     (Render loglarida ko'rinadi; SENTRY_DSN bo'lsa shu yerdan yuborish mumkin);
 *   • 4xx (mijoz) — yengil `warn`.
 * Javob shakli o'zgarmaydi: HttpException payload'i (message/reason/...) o'zicha
 * qaytadi, 5xx esa umumiy xabar (ichki tafsilot foydalanuvchiga sizib chiqmaydi).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    // SEC-08: NestJS'ning O'ZI TASHLAMAGAN, lekin haqiqiy HTTP status kodini
    // olib yuruvchi xatolar bor — masalan Express/body-parser'ning
    // `PayloadTooLargeError`si (`.status`/`.statusCode` = 413, `http-errors`
    // konvensiyasi). Ular `HttpException` EMAS, shuning uchun ilgari
    // bu yerda HAR DOIM 500'ga tushib qolardi — SEC-08'ning "413" DoD'i
    // amalda 500 bo'lib qolgan edi, shu joyda topildi va tuzatildi.
    const rawStatus = (exception as { status?: unknown; statusCode?: unknown } | null)?.status ??
      (exception as { status?: unknown; statusCode?: unknown } | null)?.statusCode;
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : typeof rawStatus === 'number' && rawStatus >= 400 && rawStatus < 600
          ? rawStatus
          : HttpStatus.INTERNAL_SERVER_ERROR;

    const err = exception instanceof Error ? exception : new Error(String(exception));
    const reqId = (req.headers['x-request-id'] as string) || '-';
    const where = `[${reqId}] ${req.method} ${req.url} -> ${status}`;

    if (status >= 500) {
      // Kutilmagan xato — to'liq kontekst + stack (prod'da diagnostika uchun).
      this.logger.error(`${where}: ${err.message}`, err.stack);
    } else {
      this.logger.warn(`${where}: ${err.message}`);
    }

    // Xom (HttpException bo'lmagan) xato haqiqiy 4xx bo'lsa (masalan 413) —
    // xabari mijoz uchun xavfsiz va foydali (stack/ichki yo'l sizmaydi),
    // shuning uchun "Ichki server xatosi" bilan yashirilmaydi.
    const isRawClientError =
      !(exception instanceof HttpException) && typeof rawStatus === 'number' && rawStatus >= 400 && rawStatus < 500;

    const body =
      exception instanceof HttpException
        ? exception.getResponse()
        : isRawClientError
          ? { statusCode: status, message: err.message, reason: 'request_error' }
          : { statusCode: status, message: 'Ichki server xatosi', reason: 'internal_error' };

    res.status(status).json(typeof body === 'string' ? { message: body } : body);
  }
}
