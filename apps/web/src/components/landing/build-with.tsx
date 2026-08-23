"use client";

import { useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";

/**
 * 03 — "NIMA QURA OLASIZ".
 *
 * NEGA INTERAKTIV: mahsulotning o'zi shunday ishlaydi — foydalanuvchi
 * biznesini tanlaydi, platforma mos agent va konnektorlarni taklif
 * qiladi. Ya'ni bu bo'lim mahsulot xulqining KICHIK NUSXASI, yonidagi
 * bezak emas. Tashrifchi o'zining sohasini bosib, o'z to'plamini ko'radi.
 *
 * KONNEKTORLAR RO'YXATI HAQIQIY: har bir `id`
 * `apps/api/src/connectors/connectors/` registrida mavjud. Bu yerda
 * hech qanday "coming soon" logotip yo'q — sanab o'tilgan hamma narsa
 * bugun chaqirilishi mumkin.
 *
 * KIRISH IMKONIYATI: `tablist` naqshi — o'q tugmalari bilan yurish,
 * Home/End, `aria-selected`, panel `tabpanel` sifatida bog'langan.
 */

interface Sector {
  id: string;
  /** Har biri konnektor registridagi ANIQ id. */
  connectors: string[];
  /** Ikki agent — i18n kalitlari. */
  agents: [string, string];
}

const SECTORS: Sector[] = [
  {
    id: "retail",
    connectors: ["uzum-market", "shopify", "payme-merchant", "eskiz-sms", "soliq-uz"],
    agents: ["b.retailA1", "b.retailA2"],
  },
  {
    id: "food",
    connectors: ["telegram-bot", "playmobile-sms", "google-sheets", "click-merchant"],
    agents: ["b.foodA1", "b.foodA2"],
  },
  {
    id: "logistics",
    connectors: ["aftership", "telegram-bot", "google-sheets", "didox-einvoice"],
    agents: ["b.logisticsA1", "b.logisticsA2"],
  },
  {
    id: "construction",
    connectors: ["google-sheets", "didox-einvoice", "soliq-uz", "smtp-email"],
    agents: ["b.constructionA1", "b.constructionA2"],
  },
  {
    id: "manufacturing",
    connectors: ["amocrm", "didox-einvoice", "soliq-uz", "google-sheets"],
    agents: ["b.manufacturingA1", "b.manufacturingA2"],
  },
  {
    id: "services",
    connectors: ["bitrix24", "whatsapp-business", "telegram-bot", "google-sheets"],
    agents: ["b.servicesA1", "b.servicesA2"],
  },
];

export function BuildWith() {
  const { t } = useT();
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (e: React.KeyboardEvent, i: number) => {
    const last = SECTORS.length - 1;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? i === last
          ? 0
          : i + 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? i === 0
            ? last
            : i - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  const sector = SECTORS[active];

  return (
    <>
      {/* Soha tanlagich */}
      <div
        role="tablist"
        aria-label={t("b.tablistLabel")}
        className="mt-10 flex flex-wrap gap-px border border-border bg-border"
      >
        {SECTORS.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            role="tab"
            id={`sector-tab-${s.id}`}
            aria-selected={i === active}
            aria-controls="sector-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => move(e, i)}
            className="min-h-[44px] flex-1 bg-[hsl(var(--surface-1))] px-4 py-3 text-[0.875rem] font-medium text-muted-foreground transition-colors hover:bg-[hsl(var(--surface-2))] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--ring))] aria-selected:bg-[hsl(var(--surface-3))] aria-selected:text-foreground"
          >
            {t(`b.${s.id}`)}
          </button>
        ))}
      </div>

      {/* Tanlangan sohaning to'plami */}
      <div
        role="tabpanel"
        id="sector-panel"
        aria-labelledby={`sector-tab-${sector.id}`}
        tabIndex={0}
        className="grid gap-px border-x border-b border-border bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--ring))] md:grid-cols-2"
      >
        <div className="bg-[hsl(var(--surface-1))] px-5 py-6 sm:px-6">
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-muted-foreground">
            {t("b.agentsLabel")}
          </p>
          <ul className="mt-4 space-y-3">
            {sector.agents.map((a) => (
              <li key={a} className="flex items-start gap-3">
                <span
                  className="mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--cta-strong))]"
                  aria-hidden
                />
                <span className="text-[0.9375rem] leading-snug text-foreground">{t(a)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[hsl(var(--surface-1))] px-5 py-6 sm:px-6">
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-muted-foreground">
            {t("b.connectorsLabel")}
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {sector.connectors.map((c) => (
              <li
                key={c}
                className="rounded-[2px] border border-border px-2.5 py-1 font-mono text-[0.75rem] text-foreground/85"
              >
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-muted-foreground">
            {t("b.browserNote")}
          </p>
        </div>
      </div>
    </>
  );
}
