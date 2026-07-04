// AgentNet — 3 tilli lug'at (English / Русский / O'zbek)
// Lug'at matnlari locale bo'yicha alohida fayllarda (./locales/*) —
// klientga faqat aktiv til yuklanadi (dynamic import), 3 til birdan emas.

export type Locale = "en" | "ru" | "uz";
export type Dict = Record<string, string>;

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "uz", label: "O'zbek", flag: "🇺🇿" },
];

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(v: string | undefined): v is Locale {
  return v === "en" || v === "ru" || v === "uz";
}

/** Aktiv til lug'atini yuklaydi — har bir til alohida chunk bo'lib bundlanadi. */
export async function loadDictionary(locale: Locale): Promise<Dict> {
  switch (locale) {
    case "ru":
      return (await import("./locales/ru")).default;
    case "uz":
      return (await import("./locales/uz")).default;
    default:
      return (await import("./locales/en")).default;
  }
}
