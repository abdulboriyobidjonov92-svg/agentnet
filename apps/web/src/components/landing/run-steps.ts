/**
 * IJRO O'QI — sahifaning tuzilma manbai (V4 landing signature).
 *
 * G'OYA: butun landing BITTA agent ijrosi sifatida o'qiladi. Har section
 * shu ijrodagi ANIQ hodisaga bog'lanadi va o'z `seq` raqamini oladi.
 *
 * NEGA BU DEKORATIV `01 / 02 / 03` EMAS: raqamlar haqiqiy ketma-ketlikni
 * bildiradi va hodisa nomlari o'ylab topilmagan — ular
 * `ExecutionEventType` enumidan (`schema.prisma`, blueprint §2.3 kanonik
 * ro'yxati). Ya'ni tashrifchi sahifada ko'rgan lug'at mahsulot ichida
 * ko'radigan lug'atning AYNI o'zi.
 *
 * YAGONA MANBA: ham chapdagi rail (`run-spine.tsx`), ham har section
 * tepasidagi belgi (`section-mark.tsx`) shu ro'yxatdan o'qiydi —
 * ikkinchi ro'yxat yozilmaydi.
 */

export interface RunStep {
  /** DOM'dagi lang'ar — `id` va IntersectionObserver uchun. */
  id: string;
  /** Ijro ichidagi tartib raqami (monotonik, `ExecutionEvent.seq` kabi). */
  seq: string;
  /** `ExecutionEventType` qiymati — o'zgartirilmaydi, tarjima qilinmaydi. */
  event: string;
  /** Rail'dagi qisqa izoh uchun i18n kaliti. */
  labelKey: string;
}

export const RUN_STEPS: RunStep[] = [
  { id: "hero", seq: "001", event: "RUN_STARTED", labelKey: "spine.hero" },
  { id: "guarantees", seq: "002", event: "POLICY_CHECK", labelKey: "spine.guarantees" },
  { id: "build", seq: "007", event: "TOOL_SELECTED", labelKey: "spine.build" },
];
