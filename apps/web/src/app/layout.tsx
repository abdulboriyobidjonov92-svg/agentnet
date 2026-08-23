import type { Metadata } from "next";
import localFont from "next/font/local";
import { IBM_Plex_Mono } from "next/font/google";
import { Providers } from "@/lib/providers";
import { getLocale } from "@/lib/i18n/server";
import { loadDictionary } from "@/lib/i18n/dictionary";
import "./globals.css";

// UCH ROL, UCH OILA (ilgari hammasi Geist edi — ya'ni ierarxiya faqat
// o'lcham bilan ifodalanardi). CDN'siz: `next/font` fayllarni build'ga
// qo'shadi, `src/fonts/README.md` ga qarang.
//
//   display — Cabinet Grotesk: tor apertura, yassi qorincha. Katta
//             o'lchamda "asbob" kabi o'qiladi, do'stona emas.
//   sans    — Switzer: neo-grotesk, x-balandligi katta -> mayda matn
//             ham oson skan qilinadi.
//   mono    — IBM Plex Mono: seq raqami, timestamp, konnektor ID.
//             JetBrains/Geist Mono ATAYLAB emas (AI-startap klishesi).
const cabinet = localFont({
  src: "../fonts/CabinetGrotesk-Variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-display",
  // Sarlavha almashinuvida sakrash bo'lmasin (CLS).
  adjustFontFallback: "Arial",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const switzer = localFont({
  src: "../fonts/Switzer-Variable.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-sans",
  adjustFontFallback: "Arial",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "AgentNet — Sovereign AI Operations",
  description:
    "Command an autonomous AI workforce. Life Twin, autonomous goals, cross-domain agent fusion and an enterprise C-suite — a real operations platform.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dict = await loadDictionary(locale);
  return (
    // Liquid Obsidian — yagona rejim: chuqur qora. Light bekor qilingan.
    //
    // SEC-13: `dark` klassi ilgari inline `<script>` bilan qo'yilardi. Bu
    // ilovadagi YAGONA inline skript edi va CSP uchun nonce talab qilardi.
    // Rejim BITTA bo'lgani uchun uni server-render qilingan `className`ga
    // ko'chirdik: bir belgi ham JS ishlashini kutmaydi (FOUC ham yo'qoladi),
    // CSP esa endi ilovaning O'Z inline skriptini umuman ko'rmaydi.
    <html
      lang={locale}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`dark ${cabinet.variable} ${switzer.variable} ${plexMono.variable}`}
    >
      <body className="font-sans antialiased">
        <Providers initialLocale={locale} initialDict={dict}>{children}</Providers>
      </body>
    </html>
  );
}
