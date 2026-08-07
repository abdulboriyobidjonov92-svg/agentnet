/**
 * A13 (ADR-009) — pul birligi konvertatsiyalari.
 *
 * SAQLASH BIRLIGI — tiyin, turi `bigint`. Butun hisob-kitob (yechish,
 * qaytarish, taqqoslash, agregat) FAQAT `bigint`da bajariladi: `number`
 * aralashsa JS `TypeError: Cannot mix BigInt and other types` beradi yoki
 * (yomoni) 2^53 dan katta qiymatda jimgina yaxlitlanadi.
 *
 * KO'RSATISH BIRLIGI — so'm, turi `number`. So'm qiymatlari faqat UI/matn
 * uchun; ular hech qachon qayta hisob-kitobga kirmaydi.
 *
 * Bu fayl yagona konvertatsiya nuqtasi — ilgari `Math.round(x / 100)`
 * kod bo'ylab 8+ joyda takrorlanardi (Contract: takroriy mantiq taqiqlanadi).
 */

/** 1 so'm = 100 tiyin. */
const TIYIN_PER_SOM = 100n;

/**
 * Tiyin -> so'm (KO'RSATISH uchun, yaxlitlangan `number`).
 *
 * Xavfsiz: so'm qiymati tiyindan 100 barobar kichik, ya'ni real balanslar
 * `Number.MAX_SAFE_INTEGER` dan uzoq. Juda katta qiymatda ham natija
 * ko'rsatish uchun ishlatiladi, hisob uchun emas.
 */
export function tiyinToSom(tiyin: bigint): number {
  // Yarim-yuqoriga yaxlitlash — ilgarigi `Math.round(x / 100)` bilan bir xil.
  const abs = tiyin < 0n ? -tiyin : tiyin;
  const rounded = (abs + TIYIN_PER_SOM / 2n) / TIYIN_PER_SOM;
  return Number(tiyin < 0n ? -rounded : rounded);
}

/** So'm (foydalanuvchi kiritgan `number`) -> tiyin (`bigint`). */
export function somToTiyin(som: number): bigint {
  return BigInt(Math.round(som * 100));
}

/**
 * Butun bo'lish — nechta narsa sotib olinadi (masalan qolgan xabarlar soni).
 * `bigint` bo'lishi allaqachon butun, shuning uchun `Math.floor` kerak emas.
 */
export function divideTiyin(total: bigint, unitPrice: bigint): number {
  if (unitPrice <= 0n) return 0;
  return Number(total / unitPrice);
}

/** Kattalik (absolyut qiymat) — `Math.abs` `bigint` bilan ishlamaydi. */
export function absTiyin(tiyin: bigint): bigint {
  return tiyin < 0n ? -tiyin : tiyin;
}
