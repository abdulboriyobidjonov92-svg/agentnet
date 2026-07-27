import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/lib/providers";
import { getLocale } from "@/lib/i18n/server";
import { loadDictionary } from "@/lib/i18n/dictionary";
import "./globals.css";

// Bitta oila — Geist. Display, UI va mono (raqamlar) uchun.
// CDN'siz (next/font orqali o'z-o'zidan hosting) — yuklanish xavfi yo'q.

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://agentnet-web.vercel.app";
const title = "AgentNet — Sovereign AI Operations";
const description =
  "Command an autonomous AI workforce. Life Twin, autonomous goals, cross-domain agent fusion and an enterprise C-suite — a real operations platform.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: "%s — AgentNet" },
  description,
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "AgentNet",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dict = await loadDictionary(locale);
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <head>
        {/* Liquid Obsidian — yagona rejim: chuqur qora. Light bekor qilindi. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add('dark')`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <Providers initialLocale={locale} initialDict={dict}>{children}</Providers>
      </body>
    </html>
  );
}
