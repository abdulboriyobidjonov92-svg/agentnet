"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Phase 5 (P5.1) — brauzerdagi RENDER xatolari uchun oxirgi to'siq.
 *
 * NEGA KERAK: `instrumentation-client.ts` dagi Sentry init ushlanmagan
 * `error` / `unhandledrejection` hodisalarini oladi, LEKIN React render
 * xatosi (komponent ichida tashlangan xato) React tomonidan USHLANADI va
 * global handler'ga umuman yetib bormaydi. Next.js uchun yagona to'g'ri
 * ushlash nuqtasi — `global-error.tsx`. Usiz "oq ekran" hodisalari
 * telemetriyada KO'RINMAS edi.
 *
 * MUHIM (Next shartnomasi): bu komponent ildiz `layout.tsx` O'RNIGA
 * render bo'ladi, ya'ni o'z `<html>`/`<body>` ini o'zi beradi va
 * `globals.css` ni KO'RMAYDI. Shu sababli stillar inline —
 * `style-src 'unsafe-inline'` allaqachon hujjatlashtirilgan istisno
 * (`src/lib/security-headers.ts`).
 *
 * i18n: matn uchala tilda (CLAUDE.md shartnomasi). Lug'at YUKLANMAYDI —
 * u serverdan keladi va bu yerda (layout yiqilgan holatda) mavjud emas;
 * shuning uchun uchta qator shu faylda, `<html lang>` bo'yicha tanlanadi.
 *
 * SIR: xato MATNI ekranda KO'RSATILMAYDI (u ichki yo'l/qiymat olib
 * yurishi mumkin) — faqat Sentry hodisa ID'si, u sirsiz korrelyatsiya
 * yorlig'i.
 */

const TEXT = {
  uz: {
    title: "Kutilmagan xato",
    body: "Sahifani yuklab bo'lmadi. Qayta urinib ko'ring — muammo takrorlansa, quyidagi ID bilan murojaat qiling.",
    retry: "Qayta urinish",
  },
  ru: {
    title: "Непредвиденная ошибка",
    body: "Не удалось загрузить страницу. Попробуйте снова — если проблема повторяется, обратитесь в поддержку с этим ID.",
    retry: "Повторить",
  },
  en: {
    title: "Unexpected error",
    body: "The page failed to load. Please try again — if it keeps happening, contact support with the ID below.",
    retry: "Try again",
  },
} as const;

type Locale = keyof typeof TEXT;

function resolveLocale(): Locale {
  if (typeof document === "undefined") return "en";
  const lang = document.documentElement.lang;
  return lang === "uz" || lang === "ru" ? lang : "en";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry sozlanmagan bo'lsa bu no-op (SDK init qilinmagan).
    Sentry.captureException(error);
  }, [error]);

  const t = TEXT[resolveLocale()];
  // `digest` — Next'ning O'ZI bergan barqaror xato identifikatori
  // (server loglari bilan bog'lanadi). Xato MATNI emas, shuning uchun
  // ko'rsatish xavfsiz.
  const reference = error.digest;

  return (
    <html lang={resolveLocale()}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050507",
          color: "#e6e6ea",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "480px", textAlign: "center" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 600, margin: "0 0 12px" }}>{t.title}</h1>
          <p style={{ fontSize: "14px", lineHeight: 1.6, opacity: 0.7, margin: "0 0 24px" }}>
            {t.body}
          </p>
          {reference ? (
            <p
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: "12px",
                opacity: 0.45,
                margin: "0 0 24px",
                wordBreak: "break-all",
              }}
            >
              {reference}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#17171c",
              color: "#e6e6ea",
              border: "1px solid #2a2a33",
              borderRadius: "10px",
              padding: "10px 20px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            {t.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
