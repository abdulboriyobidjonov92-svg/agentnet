// PUBLIC ulashilgan natija sahifasi (/s/<token>) — kirishsiz ochiladi.
// PLG viral halqasi: "AgentNet bilan yaratilgan" watermark + ro'yxatdan o'tish CTA.
// Server komponenti — OG-preview (Telegram/ijtimoiy) uchun metadata generatsiya qiladi.

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sparkles, Eye } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Metric {
  label: string;
  value: string;
  hint?: string;
}
interface SharedResult {
  kind: string;
  title: string;
  subtitle: string | null;
  metrics: Metric[];
  body: string | null;
  locale: string | null;
  createdAt: string;
  views: number;
  authorName: string | null;
}

// Public sahifa — bir nechta til, useT (client) ishlamaydi, shuning uchun kichik inline lug'at
const STR = {
  uz: { watermark: "AgentNet bilan yaratilgan", cta: "O'zingiz ham AgentNet'da yarating", views: "ko'rish", by: "muallif" },
  ru: { watermark: "Создано с AgentNet", cta: "Создайте своё в AgentNet", views: "просмотров", by: "автор" },
  en: { watermark: "Made with AgentNet", cta: "Create your own on AgentNet", views: "views", by: "by" },
} as const;

function pick(locale: string | null | undefined) {
  return STR[(locale as keyof typeof STR) in STR ? (locale as keyof typeof STR) : "uz"];
}

async function fetchShare(token: string): Promise<SharedResult | null> {
  try {
    const res = await fetch(`${API}/api/share/${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as SharedResult;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await fetchShare(token);
  if (!data) return { title: "AgentNet" };
  const desc = data.subtitle ?? pick(data.locale).watermark;
  return {
    title: `${data.title} — AgentNet`,
    description: desc,
    openGraph: { title: data.title, description: desc, type: "article", siteName: "AgentNet" },
    twitter: { card: "summary_large_image", title: data.title, description: desc },
  };
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await fetchShare(token);
  if (!data) notFound();
  const s = pick(data.locale);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4">
      <div className="w-full max-w-lg">
        <div className="liquid-glass overflow-hidden rounded-3xl border border-white/[0.08] shadow-lift">
          <div className="p-7">
            {/* Brend */}
            <div className="mb-5 flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--vein-cyan)), hsl(var(--vein-violet)))",
                  boxShadow: "0 0 12px hsl(var(--vein-cyan) / 0.6)",
                }}
              />
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.3em] text-foreground/80">AgentNet</span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-foreground">{data.title}</h1>
            {data.subtitle && <p className="mt-1 text-sm text-muted-foreground">{data.subtitle}</p>}

            {data.metrics.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-3">
                {data.metrics.map((m, i) => (
                  <div key={i} className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="mt-1 text-xl font-bold text-foreground">{m.value}</p>
                    {m.hint && <p className="mt-0.5 text-[11px] text-muted-foreground/70">{m.hint}</p>}
                  </div>
                ))}
              </div>
            )}

            {data.body && <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{data.body}</p>}

            <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground/70">
              {data.authorName && <span>{s.by}: {data.authorName}</span>}
              <span className="ml-auto inline-flex items-center gap-1">
                <Eye className="h-3 w-3" /> {data.views} {s.views}
              </span>
            </div>
          </div>

          {/* Watermark + CTA */}
          <div className="border-t border-white/[0.06] bg-black/30 px-7 py-5">
            <p className="mb-3 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">
              {s.watermark}
            </p>
            <Link
              href="/sign-up"
              className="mercury flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold"
            >
              <Sparkles className="h-4 w-4" /> {s.cta}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
