import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * SEC-05 (Option B) — endpointni global `AuthGuard`dan ochiq deb belgilaydi.
 *
 * Ishlatish o'rni — FAQAT haqiqatan autentifikatsiyasiz endpointlar:
 *   - to'lov/messenger webhooklari (Payme, Click, Telegram, Clerk) — o'z
 *     imzo/sirini ICHKARIDA tekshiradi, AuthGuard'ga aloqasi yo'q;
 *   - servislararo `InternalTokenGuard`-himoyalangan yo'llar (engine->API) —
 *     bu yerda `@Public()` FAQAT AuthGuard'ni o'tkazib yuboradi,
 *     `InternalTokenGuard` alohida, o'z holicha ishlashda davom etadi;
 *   - companion (qurilma) endpointlari — `x-companion-token` bilan o'z
 *     ichida autentifikatsiya qiladi (`authCompanion()`), AuthGuard'ga
 *     aloqasi yo'q;
 *   - login-oldi oqim (dev-login, otp/request, otp/verify, 2fa/login-verify) —
 *     foydalanuvchida hali token yo'q;
 *   - ochiq katalog/ro'yxat endpointlari (health, connectors/govtech katalogi,
 *     marketplace ro'yxati/sharhlari, ulashilgan natija).
 *
 * Yangi endpoint yozganda bu dekoratordan FOYDALANMASLIK — default xavfsizroq.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
