/**
 * A13 (ADR-009) — pul qiymatlari API'dan SATR sifatida keladi.
 *
 * Backend'da pul `BigInt` tiyin. `JSON.stringify(BigInt)` xato beradi,
 * shuning uchun API uni satrga o'giradi (`bigint-serialize.ts`). Satr
 * tanlangani `number` aniqligini yo'qotmaslik uchun: `Number` xavfsiz butun
 * chegarasi 2^53-1, undan katta tiyin qiymati JIMGINA yaxlitlanardi.
 *
 * Shu sabab frontend pul maydonini HECH QACHON to'g'ridan-to'g'ri
 * arifmetikaga qo'shmaydi — avval shu yerdagi funksiyalardan o'tkazadi.
 */

/** API'dan keladigan pul maydonining mumkin bo'lgan shakllari. */
export type TiyinValue = string | number | bigint | null | undefined;

/** Xom qiymatni `bigint` tiyinga o'giradi (noto'g'ri/bo'sh -> 0n). */
export function toTiyin(value: TiyinValue): bigint {
  if (value === null || value === undefined || value === "") return 0n;
  try {
    return typeof value === "bigint" ? value : BigInt(value);
  } catch {
    // Kutilmagan format (masalan kasrli satr) — UI'ni buzmaymiz.
    return 0n;
  }
}

/** Tiyin -> so'm (ko'rsatish uchun yaxlitlangan `number`). */
export function tiyinToSom(value: TiyinValue): number {
  const tiyin = toTiyin(value);
  const abs = tiyin < 0n ? -tiyin : tiyin;
  const rounded = (abs + 50n) / 100n;
  return Number(tiyin < 0n ? -rounded : rounded);
}

/** Tiyin -> mahalliylashtirilgan so'm satri (masalan "10 000"). */
export function formatSom(value: TiyinValue, locale = "ru-RU"): string {
  return tiyinToSom(value).toLocaleString(locale);
}

/** Pul qiymati musbatmi (masalan "payout mavjud" tekshiruvi). */
export function isPositiveTiyin(value: TiyinValue): boolean {
  return toTiyin(value) > 0n;
}
