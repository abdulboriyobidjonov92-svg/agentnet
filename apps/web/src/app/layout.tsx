import type { Metadata } from "next";
import { Sora, Manrope } from "next/font/google";
import { Providers } from "@/lib/providers";
import { getLocale } from "@/lib/i18n/server";
import "./globals.css";

const display = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
});
const body = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "AgentNet — Halal-first AI platform",
  description:
    "Build and orchestrate halal AI agents with a no-code builder. Prayer, Quran, health, finance — aligned with Islamic values.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning className={`${display.variable} ${body.variable}`}>
      <head>
        {/* Deep space (dark) — asosiy rejim; foydalanuvchi tanlagan bo'lsa light */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('agentnet_theme');if(t!=='light'){document.documentElement.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
