import { Injectable } from '@nestjs/common';
import {
  paginate,
  type Page,
  type PageQuery,
  type PaginatableArgs,
  type PaginatableDelegate,
} from '../common/pagination/paginate';

/**
 * SEC-06 AC — "cross-tenant o'qishning yagona nuqtasi."
 *
 * Bu servis ATAYLAB hech narsani avtomatik scope QILMAYDI — u
 * `ScopedQuery`ning aksi: kimdir tenant-chegarasidan tashqari o'qishni
 * xohlasa, buni FAQAT shu yagona, nomlangan, qidiriladigan joydan qilishi
 * kerak (grep `AdminQueryService` = "qaysi joylarda ataylab cross-tenant
 * o'qish bor" degan savolga to'liq javob).
 *
 * Phase 4: chaqiruvchilar — `admin/` modulidagi servislar. HAR BIR admin
 * o'qishi shu yerdan o'tadi; controller'lar Prisma'ga to'g'ridan-to'g'ri
 * murojaat qilmaydi (Contract Rule #22 va §6.2).
 *
 * MAS'ULIYAT CHEGARASI: bu servis avtorizatsiya QILMAYDI — u faqat
 * arxitektura chegarasi ("cross-tenant o'qish shu yerdan o'tdi").
 * Avtorizatsiya `@Roles(...)` + global `RolesGuard` zimmasida (SEC-05),
 * maydon-darajasidagi sir-filtri esa chaqiruvchi servisning `select`ida.
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

  /** `prisma.<model>.findUnique` — admin detal ekranlari uchun. */
  findUnique<T>(delegate: { findUnique: (args: unknown) => Promise<T | null> }, args: unknown): Promise<T | null> {
    return delegate.findUnique(args);
  }

  /**
   * Kursorli sahifa (Phase 3 shartnomasi, Konstitutsiya #24).
   *
   * ATAYLAB umumiy `paginate()` helper'iga o'tkazadi — pagination mantig'i
   * TAKRORLANMAYDI (`id` teng-buzuvchisi, `limit + 1` naqshi, eskirgan
   * kursor xulqi bir joyda qoladi). Bu metod ustiga faqat "admin o'qishi
   * shu yerdan o'tdi" degan chegarani qo'shadi.
   */
  paginate<T extends { id: string }>(
    delegate: PaginatableDelegate<T>,
    args: PaginatableArgs,
    query: PageQuery,
  ): Promise<Page<T>> {
    return paginate(delegate, args, query);
  }

  /** Filtrlangan jami son (ro'yxat sarlavhasidagi "N ta natija" uchun). */
  count(delegate: { count: (args: unknown) => Promise<number> }, args: unknown): Promise<number> {
    return delegate.count(args);
  }
}
