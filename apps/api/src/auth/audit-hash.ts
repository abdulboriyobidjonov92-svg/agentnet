import * as crypto from 'crypto';

/**
 * A17 / ADR-008 — audit hash-zanjirining YAKUNIY (canonical) formati.
 *
 * MUAMMO (bu fayl paydo bo'lishiga sabab): ilgari hash `record()` ga kelgan
 * KIRISH obyektidan hisoblanardi (`JSON.stringify(params)`). Natijada
 * saqlangan qatordan hash'ni QAYTA HISOBLAB BO'LMASDI, ya'ni zanjir amalda
 * tekshirilmas edi:
 *   • `resourceId` berilmasa JSON'da UMUMAN yo'q edi, DB'da esa `null`;
 *   • `metadata` `jsonb` sifatida saqlanadi — Postgres kalitlarni QAYTA
 *     TARTIBLAYDI, ya'ni o'qilgan JSON kiritilganidan boshqa satr berardi.
 * Jonli bazada tasdiqlangan: metadata'li yozuv (`agent.create`) hech qanday
 * usul bilan qayta hisoblanmasdi.
 *
 * QOIDALAR (o'zgarmaydi):
 *   1. Hash FAQAT saqlangan ustun qiymatlaridan hisoblanadi — hech qachon
 *      ish-vaqti (runtime) obyektidan.
 *   2. Kalit tartibiga bog'liq emas — rekursiv kanonik tartiblash.
 *   3. `undefined`/`null` farqiga bog'liq emas — `undefined` mavjud emas,
 *      yo'q qiymat doim `null`.
 *   4. Pozitsion massiv — yuqori darajada kalit nomi umuman qatnashmaydi.
 */

/** Zanjir boshi — aktorning birinchi yozuvi uchun `prevHash`. */
export const AUDIT_GENESIS = 'GENESIS';

/**
 * Qiymatni kanonik ko'rinishga keltiradi: obyekt kalitlari REKURSIV
 * tartiblanadi, massiv tartibi SAQLANADI (massiv — tartiblangan ma'lumot),
 * `undefined` va funksiyalar `null` ga aylanadi (JSON'da ular yo'qoladi —
 * bu esa aynan biz qochayotgan noaniqlik).
 */
export function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) return null;

  // Date -> ISO (DB'dan kelgan `createdAt` shu ko'rinishda barqaror)
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) return value.map(canonicalize);

  if (typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort()) {
      out[key] = canonicalize(src[key]);
    }
    return out;
  }

  if (typeof value === 'function' || typeof value === 'symbol') return null;

  return value;
}

/** Kanonik JSON satri — bir xil ma'lumot doim bir xil satr beradi. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/**
 * Zanjir yozuvining hash hisoblanadigan qismi — HAMMASI saqlanadigan ustunlar.
 *
 * `seq` ATAYLAB yo'q: u `autoincrement()` bilan DB tomonidan beriladi, ya'ni
 * hash hisoblanayotganda hali ma'lum emas. Tartib kafolatini `prevHash`
 * bog'lanishi beradi (yozuvni o'chirish/qo'shish zanjirni uzadi).
 *
 * `createdAt` esa BOR va u kodda ANIQ o'rnatiladi (DB default'iga tashlab
 * qo'yilmaydi) — shu sabab vaqt belgisini keyin o'zgartirish ham zanjirni
 * buzadi.
 */
export interface AuditHashInput {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  createdAt: Date | string;
  metadata: unknown;
}

/**
 * Yozuv hash'i.
 *
 * MUHIM: `metadata` bu yerga DB'DAN O'QILGAN ko'rinishda berilishi SHART
 * (Prisma `create` `RETURNING` bilan qaytargan qiymat ham shunday) — aks
 * holda `jsonb` normalizatsiyasi (kalit tartibi, son formati) tufayli
 * keyinchalik qayta hisoblash mos kelmasligi mumkin.
 */
export function computeEntryHash(prevHash: string, row: AuditHashInput): string {
  const payload = canonicalJson([
    prevHash,
    row.actorId,
    row.action,
    row.resourceType,
    row.resourceId ?? null,
    row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    canonicalize(row.metadata ?? null),
  ]);

  return crypto.createHash('sha256').update(payload).digest('hex');
}
