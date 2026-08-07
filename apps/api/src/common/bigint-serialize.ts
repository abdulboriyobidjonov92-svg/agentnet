/**
 * A13 (ADR-009) — `BigInt` ni JSON javoblarida SATR sifatida uzatish.
 *
 * MUAMMO: `JSON.stringify(1n)` `TypeError: Do not know how to serialize a
 * BigInt` tashlaydi. Pul ustunlari `BigInt` bo'lgach, HAR BIR javob (Nest
 * serializatsiyasi, `res.json`, log, SSE) shu xatoga uchrardi.
 *
 * NEGA SATR, `Number` EMAS: `Number` xavfsiz butun son chegarasi
 * 9 007 199 254 740 991 (2^53-1). Undan katta tiyin qiymati JIMGINA
 * yaxlitlanardi — ya'ni `Int` shiftini kattaroq shift bilan almashtirgan
 * bo'lardik. Satr aniqlikni to'liq saqlaydi va JSON'da universal.
 *
 * NEGA GLOBAL PATCH: `BigInt.prototype.toJSON` — bu qiymat JSON'ga qayerda
 * tushishidan qat'i nazar (controller javobi, exception filter, logger,
 * BFF proxy) BIR XIL ishlashini kafolatlaydigan yagona nuqta. Har DTO'da
 * qo'lda `.toString()` yozish — unutiladigan va takrorlanadigan yechim
 * (Contract: takroriy mantiq taqiqlanadi).
 *
 * Mijoz tomoni: pul maydonlari doim `string` sifatida keladi
 * (`"158920000"`). Frontend ularni `BigInt(...)` yoki `Number(...)` bilan
 * o'qiydi — `apps/web/src/lib/money.ts` ga qarang.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface BigInt {
    toJSON(): string;
  }
}

let installed = false;

/**
 * `BigInt.prototype.toJSON` ni o'rnatadi. `main.ts` da, Nest ilovasi
 * yaratilishidan OLDIN chaqiriladi.
 *
 * Idempotent: takroriy chaqiruv (masalan testlarda) hech narsa qilmaydi.
 */
export function installBigIntJsonSerializer(): void {
  if (installed) return;

  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value: function toJSON(this: bigint): string {
      return this.toString();
    },
    writable: true,
    configurable: true,
    enumerable: false, // aks holda `{...obj}` va for-in ga tushib qolardi
  });

  installed = true;
}
