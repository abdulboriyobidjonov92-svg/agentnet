import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ImpersonationService } from './impersonation.service';
import type { ImpersonationContext } from './impersonation.types';

/**
 * SEC-12 §6.6 / §11 — "har so'rov `AuditLog`ga yoziladi".
 *
 * Global `APP_INTERCEPTOR`. Impersonation BO'LMAGAN so'rovlarda hech narsa
 * qilmaydi (nol qo'shimcha xarajat).
 *
 * VAZIFA BO'LINISHI `ImpersonationGuard` bilan: NestJS'da guardlar
 * interceptor'dan OLDIN ishlaydi, ya'ni guard RAD ETGAN so'rov bu yerga
 * yetib kelmaydi. Shuning uchun:
 *   • rad etilgan so'rovni guard o'zi yozadi,
 *   • ruxsat berilgan so'rovni (haqiqiy HTTP holati bilan) shu interceptor.
 * Ikkalasi bitta metodga (`recordRequest`) boradi — format bir xil.
 *
 * Handler ichidagi XATO ham yoziladi (`error` shoxi): 404/500 bilan tugagan
 * impersonation so'rovi jurnaldan tushib qolmasligi kerak.
 *
 * NEGA JAVOB KUTILMAYDI (fire-and-forget): audit yozuvi javob yo'lida
 * advisory-lock'li tranzaksiya — uni kutish har o'qishga latency qo'shardi.
 * Yozuv javob YAKUNLANGANDA darhol boshlanadi va `AuditLogService.record`
 * xatolarni o'zi yutadi (asosiy oqimni hech qachon buzmaydi). Yo'qotish
 * xavfi faqat jarayonning qattiq qulashida — kutilgan holatda ham xuddi
 * shunday, chunki tranzaksiya baribir yarim qolardi.
 *
 * NARX: har impersonation so'rovi — bitta audit yozuvi. ATAYLAB qabul
 * qilingan: sessiya 30 daqiqa bilan chegaralangan, nazoratsiz impersonation
 * esa Contract §4 bo'yicha umuman taqiqlangan.
 */
@Injectable()
export class ImpersonationAuditInterceptor implements NestInterceptor {
  constructor(private readonly impersonation: ImpersonationService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const ctx = request?.impersonation as ImpersonationContext | undefined;

    if (!ctx) return next.handle();

    const method = String(request.method ?? '').toUpperCase();
    const route = this.routeOf(request);

    const record = (statusCode: number) => {
      void this.impersonation
        .recordRequest({ context: ctx, method, route, outcome: 'allowed', statusCode })
        .catch(() => undefined);
    };

    // `complete`/`error` — oqim boshiga BIR MARTA ishlaydi (har emissiyada
    // emas), ya'ni SSE javobi ham bitta yozuv beradi.
    return next.handle().pipe(
      tap({
        complete: () => record(http.getResponse()?.statusCode ?? 200),
        error: (err: { getStatus?: () => number }) =>
          record(typeof err?.getStatus === 'function' ? err.getStatus() : 500),
      }),
    );
  }

  private routeOf(request: { originalUrl?: string; url?: string }): string {
    const raw = request.originalUrl ?? request.url ?? '';
    return raw.split('?')[0].replace(/^\/+/, '').replace(/^api\//, '');
  }
}
