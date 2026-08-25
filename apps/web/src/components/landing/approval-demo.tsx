"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

/**
 * 07 — SAHIFANING O'Z IJROSI SHU YERDA TO'XTAYDI (signature moment).
 *
 * G'OYA: mahsulotning eng muhim da'vosi — "agent harakat qilishdan oldin
 * so'raydi" — hech qanday matn bilan isbotlanmaydi, lekin BITTA BOSISH
 * bilan his qilinadi. Landing bo'ylab davom etayotgan ijro shu yerda
 * `APPROVAL_REQUIRED` ga yetadi va tashrifchidan javob kutadi.
 *
 * IKKALA SHOX HAM KO'RSATILADI. Faqat "Tasdiqlash" yo'lini ko'rsatish
 * demo bo'lardi; rad etish yo'li esa haqiqatni aytadi: amal BAJARILMAYDI
 * va ijro `RUN_CANCELLED` bilan tugaydi. Rad etish "xato" emas — u ham
 * to'g'ri natija, shuning uchun qizil bilan bo'yalmaydi.
 *
 * SCROLL BLOKLANMAYDI. Faqat shu bo'limning davomi kutadi — sahifani
 * garovga olish dushmanona naqsh bo'lardi.
 *
 * KIRISH IMKONIYATI: natija `aria-live="polite"` bilan e'lon qilinadi,
 * tugmalar 44px, qaytadan urinish tugmasi har doim bor.
 */

type Decision = "pending" | "approved" | "rejected";

interface TraceLine {
  seq: string;
  event: string;
  detail: string;
  tone?: "ok" | "muted" | "waiting";
}

const APPROVED_TRACE: TraceLine[] = [
  { seq: "040", event: "APPROVAL_GRANTED", detail: "user", tone: "ok" },
  { seq: "041", event: "TOOL_STARTED", detail: "payme-merchant.create_receipt" },
  { seq: "042", event: "TOOL_RESULT", detail: "receipt A-2291 · 340 ms", tone: "ok" },
  { seq: "043", event: "RUN_COMPLETED", detail: "3.1 s · 1 240 token", tone: "ok" },
];

const REJECTED_TRACE: TraceLine[] = [
  { seq: "040", event: "APPROVAL_DENIED", detail: "user", tone: "muted" },
  { seq: "041", event: "RUN_CANCELLED", detail: "—", tone: "muted" },
];

export function ApprovalDemo() {
  const { t } = useT();
  const [decision, setDecision] = useState<Decision>("pending");
  const trace = decision === "approved" ? APPROVED_TRACE : REJECTED_TRACE;

  return (
    <div className="mt-12 border border-white/[0.08]">
      {/* Taklif qilingan amal — foydalanuvchi AYNAN nimani tasdiqlayotganini
          ko'radi. Yashirin parametr bilan tasdiq so'rash ma'nosiz bo'lardi. */}
      <div className="border-b border-white/[0.08] bg-white/[0.025] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-white/50">
            <span className="tabular-nums text-[hsl(var(--violet-text))]">039</span>
            APPROVAL_REQUIRED
          </p>
          <span className="rounded-md border border-[hsl(var(--risk-high)/0.4)] px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-[hsl(var(--risk-high))]">
            {t("risk.high")}
          </span>
        </div>

        <p className="mt-4 font-mono text-[0.875rem] text-white">
          payme-merchant.create_receipt
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md border border-white/[0.08] px-3 py-2.5 font-mono text-[0.75rem] leading-relaxed text-white/75">
{`{
  "amount": 4850000,
  "order_id": "UZM-100482",
  "description": "Uzum buyurtmasi"
}`}
        </pre>
      </div>

      {/* Qaror qatori */}
      <div className="bg-white/[0.025] px-5 py-5 sm:px-6">
        {decision === "pending" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setDecision("approved")}
              className="cta inline-flex h-11 items-center justify-center rounded-lg px-5 text-[0.9375rem] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--surface-1))]"
            >
              {t("c.approve")}
            </button>
            <button
              type="button"
              onClick={() => setDecision("rejected")}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-white/[0.08] px-5 text-[0.9375rem] font-medium text-white transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--surface-1))]"
            >
              {t("c.reject")}
            </button>
            <p className="text-[0.8125rem] leading-relaxed text-white/50 sm:ml-2">
              {t("x.hint")}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDecision("pending")}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-white/[0.08] px-5 text-[0.875rem] font-medium text-white/50 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--surface-1))]"
          >
            {t("x.again")}
          </button>
        )}
      </div>

      {/* Natija — ijro davom etadi yoki to'xtaydi */}
      <div
        aria-live="polite"
        className="border-t border-white/[0.08] bg-white/[0.025] px-5 py-5 sm:px-6"
      >
        {decision === "pending" ? (
          <p className="font-mono text-[0.75rem] text-white/50/60">{t("x.waiting")}</p>
        ) : (
          <>
            <ol className="space-y-2">
              {trace.map((l) => (
                <li key={l.seq} className="grid grid-cols-[auto_1fr] gap-3 sm:grid-cols-[auto_auto_1fr] sm:gap-4">
                  <span className="font-mono text-[0.6875rem] tabular-nums text-white/50">
                    {l.seq}
                  </span>
                  <span
                    className={`font-mono text-[0.6875rem] uppercase tracking-[0.12em] ${
                      l.tone === "ok"
                        ? "text-[hsl(var(--state-success))]"
                        : l.tone === "muted"
                          ? "text-white/50"
                          : "text-white/85"
                    }`}
                  >
                    {l.event}
                  </span>
                  <span className="col-span-2 font-mono text-[0.6875rem] text-white/50 sm:col-span-1">
                    {l.detail}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[0.875rem] leading-relaxed text-white/75">
              {t(decision === "approved" ? "x.approvedNote" : "x.rejectedNote")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
