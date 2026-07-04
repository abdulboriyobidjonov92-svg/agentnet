"use client";
import { createContext, useContext, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, LOCALES, loadDictionary, type Dict, type Locale } from "./dictionary";

const LOCALE_COOKIE = "agentnet_locale";

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<Ctx>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (k) => k,
});

export function LanguageProvider({
  initialLocale,
  initialDict,
  children,
}: {
  initialLocale: Locale;
  initialDict: Dict;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [dict, setDict] = useState<Dict>(initialDict);

  const setLocale = useCallback(
    (l: Locale) => {
      // Yangi til chunki yuklangach almashtiriladi — kalitlar "yalt" etib ko'rinmaydi
      void loadDictionary(l).then((d) => {
        setDict(d);
        setLocaleState(l);
        document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
        router.refresh();
      });
    },
    [router],
  );

  const t = useCallback((key: string) => dict[key] ?? key, [dict]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useT() {
  return useContext(LanguageContext);
}

export { LOCALES };
export type { Locale };
