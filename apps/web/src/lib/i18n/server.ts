import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, loadDictionary, type Locale } from "./dictionary";

export const LOCALE_COOKIE = "agentnet_locale";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const val = store.get(LOCALE_COOKIE)?.value;
  return isLocale(val) ? val : DEFAULT_LOCALE;
}

export async function getT() {
  const locale = await getLocale();
  const d = await loadDictionary(locale);
  const t = (key: string) => d[key] ?? key;
  return { t, locale };
}
