import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/lib/providers";
import { getLocale } from "@/lib/i18n/server";
import { loadDictionary } from "@/lib/i18n/dictionary";
import "./globals.css";

// Bitta oila — Geist. Display, UI va mono (raqamlar) uchun.
// CDN'siz (next/font orqali o'z-o'zidan hosting) — yuklanish xavfi yo'q.

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
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="font-sans antialiased">
        <Providers initialLocale={locale} initialDict={dict}>{children}</Providers>
      </body>
    </html>
  );
}
