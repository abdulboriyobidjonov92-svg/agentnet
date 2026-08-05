import { Injectable } from '@nestjs/common';

/**
 * SEC-06 AC — "cross-tenant o'qishning yagona nuqtasi."
 *
 * Bu servis ATAYLAB hech narsani avtomatik scope QILMAYDI — u
 * `ScopedQuery`ning aksi: kimdir tenant-chegarasidan tashqari o'qishni
 * xohlasa, buni FAQAT shu yagona, nomlangan, qidiriladigan joydan qilishi
 * kerak (grep `AdminQueryService` = "qaysi joylarda ataylab cross-tenant
 * o'qish bor" degan savolga to'liq javob).
 *
 * Hozircha chaqiruvchisi yo'q — Phase 4 (Admin Panel) hali boshlanmagan
 * (Engineering Contract §3 Critical Path). Bu SEC-06'ning o'zi talab
 * qilgan minimal infratuzilma; yangi controller/route/modul QASDAN
 * qo'shilmagan (Phase 0-4 feature freeze, A39).
 */
@Injectable()
export class AdminQueryService {
  /**
   * `prisma.<model>.findMany` ustidan to'g'ridan-to'g'ri o'tkazuvchi
   * (pass-through) — hech qanday `where` avtomatik qo'shilmaydi/olib
   * tashlanmaydi. Chaqiruvchi o'zi to'liq javobgar.
   */
  findMany<T>(delegate: { findMany: (args: unknown) => Promise<T[]> }, args: unknown): Promise<T[]> {
    return delegate.findMany(args);
  }

  /** `prisma.<model>.findFirst` ustidan xuddi shunday o'tkazuvchi. */
  findFirst<T>(delegate: { findFirst: (args: unknown) => Promise<T | null> }, args: unknown): Promise<T | null> {
    return delegate.findFirst(args);
  }
}
