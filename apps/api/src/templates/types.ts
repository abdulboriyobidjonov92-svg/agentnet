/**
 * Y3: Tayyor agent shablonlari — umumiy MODULLARdan yig'iladi.
 *
 * Har shablon = kasb + modullar to'plami. Modul kod bazasi UMUMIY, kasbga
 * qarab kombinatsiya farq qiladi — bu 20 shablonni tez qurish va 20→1000
 * o'sishni osonlashtiradi (brief Y3). Har agent shunchaki "eslatma boti" emas:
 * kamida bitta BASHORAT qatlami va bitta AVTONOM harakatga ega bo'lishi kerak.
 */

export interface I18n {
  uz: string;
  ru: string;
  en: string;
}

export const tri = (uz: string, ru: string, en: string): I18n => ({ uz, ru, en });

export function loc(v: I18n, language: string): string {
  if (language === 'uz') return v.uz;
  if (language === 'ru') return v.ru;
  return v.en;
}

/** Umumiy qobiliyat moduli — bir nechta shablonda qayta ishlatiladi. */
export interface AgentModule {
  id: string;
  name: I18n;
  /** Agent system-promptiga qo'shiladigan yo'riqnoma (predict + act tamoyilini kodlaydi). */
  promptFragment: string;
  /** Modul talab qiladigan tool_id'lar. */
  tools: string[];
  /** Modulda bashorat/tahlil qatlami bormi (brief talabi). */
  prediction?: boolean;
  /** Modulda avtonom harakat (odam aralashuvisiz) bormi. */
  autonomous?: boolean;
}

/** Tayyor shablon — kasb + modullar; system-prompt modullardan yig'iladi. */
export interface AgentTemplate {
  id: string;
  profession: I18n;
  domain: string;
  vertical?: string;
  /** Murakkablik ★ (1-5) — narx va kutilmalar shunga bog'liq. */
  complexity: 1 | 2 | 3 | 4 | 5;
  createUsd: number;
  monthlyUsd: number;
  /** Yig'iladigan modullar (registry id'lari). */
  moduleIds: string[];
  /** Kasbni moslash uchun kalit so'zlar (uz/ru/en). */
  keywords: string[];
  /** Karta uchun bayroqdor xususiyat (bir qator). */
  flagship: I18n;
}
