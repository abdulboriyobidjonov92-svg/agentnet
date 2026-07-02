import { cookies } from "next/headers";
import { dictionary, DEFAULT_LOCALE, type Locale } from "./dictionary";

export const LOCALE_COOKIE = "agentnet_locale";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const val = store.get(LOCALE_COOKIE)?.value as Locale | undefined;
  return val && val in dictionary ? val : DEFAULT_LOCALE;
}

export async function getT() {
  const locale = await getLocale();
  const d = dictionary[locale];
  const t = (key: string) => d[key] ?? key;
  return { t, locale };
}
