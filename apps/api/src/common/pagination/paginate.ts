/**
 * Phase 3 — kursorli pagination shartnomasi (Engineering Contract A18 / ADR-009).
 *
 * Yagona javob shakli BARCHA ro'yxat endpointlari uchun:
 *   `{ items, nextCursor, hasMore }`
 *
 * Keyingi sahifa: `?cursor=<nextCursor>&limit=<n>`. `nextCursor === null`
 * bo'lsa — oxiri.
 */

export const DEFAULT_PAGE_LIMIT = 30;
export const MAX_PAGE_LIMIT = 100;

export interface Page<T> {
  items: T[];
  /** Keyingi sahifa uchun kursor; oxirgi sahifada `null`. */
  nextCursor: string | null;
  hasMore: boolean;
}

type SortDir = 'asc' | 'desc';
type OrderBy = Record<string, unknown>;

/** `findMany` argumentlari — `take`/`cursor`/`skip` ATAYLAB yo'q: ularni shu helper boshqaradi. */
export interface PaginatableArgs {
  where?: unknown;
  orderBy?: OrderBy | OrderBy[];
  select?: unknown;
  include?: unknown;
}

export interface PageQuery {
  limit?: number;
  cursor?: string;
}

/**
 * Sahifalanadigan Prisma delegati (`prisma.agent`, `prisma.conversation`, ...).
 *
 * any: Prisma generatsiya qiladigan delegat imzosi (`SelectSubset<T, XFindManyArgs>`)
 * modelga qattiq bog'langan va umumlashtirib bo'lmaydi — `Record<string, unknown>`
 * unga tushmaydi (`{[x: string]: never}` bilan mos kelmaydi). Argument shakli
 * helper ICHIDA to'liq quriladi (`PaginatableArgs` + take/cursor/skip), ya'ni
 * bu `any` chaqiruvchiga tarqamaydi va tashqi tip-xavfsizlikni kamaytirmaydi.
 */
export interface PaginatableDelegate<T> {
  // any: yuqoridagi izohga qarang (Prisma delegat imzosi umumlashtirilmaydi).
  findMany(args: any): Promise<T[]>;
}

/**
 * Tartibga `id` teng-buzuvchisini (tiebreaker) qo'shadi.
 *
 * NEGA MAJBURIY: kursorli pagination faqat tartib DETERMINISTIK bo'lgandagina
 * to'g'ri ishlaydi. `orderBy: { createdAt: 'desc' }` — bir xil `createdAt`li
 * ikki qator uchun tartib kafolatlanmagan, ya'ni sahifa chegarasida qator
 * TUSHIB QOLISHI yoki IKKI MARTA chiqishi mumkin. `id` (cuid, unikal va
 * monoton) teng-buzuvchi sifatida buni butunlay yopadi.
 *
 * Buni chaqiruvchiga qoldirmaymiz — "tiebreaker'ni unutish" aynan jimgina
 * buziladigan xatolar sinfi; helper uni har doim o'zi qo'shadi.
 */
function withIdTiebreaker(orderBy: OrderBy | OrderBy[] | undefined): OrderBy[] {
  const list: OrderBy[] = orderBy === undefined ? [] : Array.isArray(orderBy) ? [...orderBy] : [orderBy];

  if (list.some((o) => 'id' in o)) return list;

  // Yo'nalishni birinchi tartib-kalitidan olamiz (aralash yo'nalishda ham
  // barqaror bo'lishi uchun), bo'lmasa `desc` — ro'yxatlar deyarli doim
  // "eng yangisi tepada".
  const first = list[0];
  const dir: SortDir =
    first && typeof Object.values(first)[0] === 'string' ? (Object.values(first)[0] as SortDir) : 'desc';

  return [...list, { id: dir }];
}

export function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_PAGE_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_LIMIT);
}

/**
 * Kursorli sahifani o'qiydi.
 *
 * `limit + 1` qator so'raladi: ortiqcha qator BOR-YO'Qligi `hasMore`ni
 * beradi — ya'ni `count()` uchun ikkinchi so'rov KERAK EMAS (chuqur
 * sahifada `count` eng qimmat qism bo'lardi).
 *
 * ESKIRGAN KURSOR: Prisma yaroqsiz kursor uchun xato TASHLAMAYDI — bo'sh
 * natija qaytaradi (jonli Postgres'da tekshirilgan). Ya'ni o'chirilgan
 * qatorga ishora qiluvchi kursor 500 bermaydi, oddiy bo'sh sahifa beradi.
 */
export async function paginate<T extends { id: string }>(
  delegate: PaginatableDelegate<T>,
  args: PaginatableArgs,
  query: PageQuery = {},
): Promise<Page<T>> {
  const limit = clampLimit(query.limit);

  const rows = await delegate.findMany({
    ...args,
    orderBy: withIdTiebreaker(args.orderBy),
    take: limit + 1,
    // `skip: 1` — kursor qatorining O'ZI keyingi sahifaga tushmasligi uchun.
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
    hasMore,
  };
}
