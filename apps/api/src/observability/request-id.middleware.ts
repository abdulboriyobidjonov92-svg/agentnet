import { REQUEST_ID_HEADER, resolveRequestId, runWithRequestContext } from './request-id';

interface MinimalRequest {
  headers: Record<string, string | string[] | undefined>;
}

interface MinimalResponse {
  setHeader(name: string, value: string): void;
}

/**
 * Phase 5 (P5.3) — request-id middleware'i (Express uslubida).
 *
 * `main.ts` da `app.use(...)` bilan, MODULLARDAN OLDIN ro'yxatdan o'tadi.
 * Tartib MUHIM: `nestjs-pino` ning `genReqId` i shu yerda ALLAQACHON
 * o'rnatilgan sarlavhani o'qiydi — ya'ni ID bitta joyda hal qilinadi va
 * ikkita turli qiymat (biri logda, biri javobda) hech qachon paydo
 * bo'lmaydi.
 *
 * Uch ish qiladi:
 *   1. kiruvchi sarlavhani siyosat bo'yicha tekshiradi/yaratadi;
 *   2. KANONIK qiymatni so'rov sarlavhasiga QAYTA YOZADI (yaroqsiz qiymat
 *      shu yerda o'ladi — pastdagi hech bir qatlam uni ko'rmaydi);
 *   3. qolgan butun so'rovni ALS konteksti ichida bajaradi, shunda engine
 *      chaqiruvlari ID ni o'zi topadi (`common/engine-auth.ts`).
 */
export function requestIdMiddleware(env: NodeJS.ProcessEnv = process.env) {
  return function requestId(req: MinimalRequest, res: MinimalResponse, next: () => void): void {
    const id = resolveRequestId(req.headers[REQUEST_ID_HEADER], env);
    req.headers[REQUEST_ID_HEADER] = id;
    res.setHeader('X-Request-Id', id);
    runWithRequestContext({ requestId: id }, next);
  };
}
