"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";

/**
 * IJRO DAFTARI — hero'ning mahsulot vizualizatsiyasi.
 *
 * NEGA MOKAP EMAS: "AI robot" rasmi yoki soxta dashboard mahsulot haqida
 * hech narsa aytmaydi. Bu panel esa AgentNet'ning ASOSIY artefaktini
 * ko'rsatadi — tipli, tartiblangan ijro izi (`ExecutionEvent`, blueprint
 * §2.3). Qatorlardagi konnektor nomlari O'YLAB TOPILMAGAN: `uzum-market`,
 * `google-sheets`, `didox-einvoice`, `payme-merchant` — to'rttasi ham
 * `apps/api/src/connectors/connectors/` registrida mavjud.
 *
 * HIKOYA: uch qadam o'zi bajariladi, to'rtinchisi — pul harakati —
 * `HIGH` deb baholanadi va TO'XTAB, odamdan so'raydi. Ya'ni panel
 * mahsulotning yagona eng muhim da'vosini bir qarashda isbotlaydi.
 *
 * KIRISH IMKONIYATI: to'rttala qator DOM'da HAR DOIM turadi — animatsiya
 * faqat `data-state` ni o'zgartiradi. Skrin-rider va `prefers-reduced-motion`
 * foydalanuvchisi bir xil ma'lumotni oladi; harakat shunchaki bezak.
 */

type Tier = "low" | "medium" | "high";

interface Step {
  seq: string;
  action: string;
  tier: Tier;
  /** Bajarilish vaqti — oxirgi (kutayotgan) qadamda bo'lmaydi. */
  ms?: number;
}

const STEPS: Step[] = [
  { seq: "002", action: "uzum-market.list_orders", tier: "low", ms: 340 },
  { seq: "003", action: "google-sheets.append_row", tier: "low", ms: 210 },
  { seq: "004", action: "didox-einvoice.list_documents", tier: "medium", ms: 1180 },
  { seq: "005", action: "payme-merchant.create_receipt", tier: "high" },
];

/**
 * Oxirgi qator qancha vaqtdan keyin paydo bo'ladi.
 *
 * NEGA FAQAT BITTA HARAKAT: avval to'rttala qator navbat bilan ochilib,
 * so'ng sikl qaytadan boshlanardi — sikl boshida panel bir zumga BO'SHAB
 * qolardi va bu nosozlikka o'xshardi. Endi uchta qator darhol turadi,
 * faqat TO'RTINCHISI — tasdiq kutayotgani — bir marta suzib kiradi.
 * Ko'z aynan o'sha qatorga tushadi, sikl ham, bo'shash ham yo'q.
 */
const REVEAL_MS = 900;

const tierClass: Record<Tier, string> = {
  low: "text-[hsl(var(--risk-low))]",
  medium: "text-[hsl(var(--risk-medium))]",
  high: "text-[hsl(var(--risk-high))]",
};

export function ExecutionLedger() {
  const { t } = useT();
  // Server render'da HAMMA qator ko'rinadi (JS'siz va skrin-rider uchun
  // to'liq). Klientda faqat harakat ruxsat etilgan bo'lsa oxirgi qatorni
  // qisqa vaqtga yashirib, so'ng suzib kirgizamiz.
  const [revealed, setRevealed] = useState(true);

  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    setRevealed(false);
    const id = setTimeout(() => setRevealed(true), REVEAL_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="w-full rounded-[3px] border border-border bg-[hsl(var(--surface-1))]">
      {/* Sarlavha qatori — ijro identifikatori va vazifa */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-5">
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
          {t("hx.runLabel")}
        </span>
        <span className="font-mono text-[0.6875rem] text-[hsl(var(--accent-cyan))]">8f2c</span>
        <span className="h-3 w-px bg-border" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-foreground/80">
          {t("hx.runTask")}
        </span>
        <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--accent-cyan))] opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent-cyan))]" />
          </span>
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
            {t("hx.live")}
          </span>
        </span>
      </div>

      <ol className="divide-y divide-border">
        {STEPS.map((s, i) => {
          const isWaiting = i === STEPS.length - 1;
          const hidden = isWaiting && !revealed;
          return (
            <li
              key={s.seq}
              data-state={hidden ? "pending" : "open"}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3.5 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=pending]:translate-y-1 data-[state=pending]:opacity-0 motion-reduce:transition-none sm:gap-4 sm:px-5"
            >
              <span className="font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
                {s.seq}
              </span>
              <span className="min-w-0 truncate font-mono text-[0.75rem] text-foreground/90 sm:text-[0.8125rem]">
                {s.action}
              </span>
              <span className="flex shrink-0 items-center gap-2 sm:gap-3">
                <span
                  className={`font-mono text-[0.625rem] uppercase tracking-[0.12em] ${tierClass[s.tier]}`}
                >
                  {t(`risk.${s.tier}`)}
                </span>
                {isWaiting ? (
                  <span className="flex items-center gap-1.5 rounded-[2px] bg-[hsl(var(--state-waiting)/0.12)] px-2 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--state-waiting))]" />
                    <span className="whitespace-nowrap text-[0.6875rem] font-medium text-[hsl(var(--state-waiting))]">
                      {t("hx.awaiting")}
                    </span>
                  </span>
                ) : (
                  <span className="font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
                    {s.ms} ms
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Izoh — panel nimani ko'rsatayotganini bitta jumlada aytadi */}
      <p className="border-t border-border px-4 py-4 text-[0.75rem] leading-relaxed text-muted-foreground sm:px-5">
        {t("hx.ledgerNote")}
      </p>
    </div>
  );
}
