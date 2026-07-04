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
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <head>
        {/* Deep space (dark) — asosiy rejim; foydalanuvchi tanlagan bo'lsa light */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('agentnet_theme');if(t!=='light'){document.documentElement.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <Providers initialLocale={locale} initialDict={dict}>{children}</Providers>
      </body>
    </html>
  );
}
