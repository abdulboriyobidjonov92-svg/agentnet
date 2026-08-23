"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { RUN_STEPS } from "./run-steps";

/**
 * IJRO O'QI — chapdagi rail (signature element).
 *
 * Scroll qilganda "ijro" oldinga siljiydi: o'tilgan qadamlar so'nadi,
 * joriysi yonadi, keyingilari deyarli ko'rinmaydi.
 *
 * NEGA FAQAT `2xl` (>=1536px) DA: kontent kengligi 1240px. 1536px'da
 * chetda 148px bo'sh joy qoladi va rail (48px) hech narsani bosmaydi.
 * Undan tor ekranda rail kontent ustiga chiqardi yoki uni siqardi —
 * shuning uchun u YASHIRILADI, tuzilma esa yo'qolmaydi: har section
 * tepasida `SectionMark` (`002 · POLICY_CHECK`) HAMMA o'lchamda turadi.
 *
 * `aria-hidden`: rail — sahifadagi mavjud sarlavhalarning takrori
 * (navigatsiya emas, ko'rsatkich). Skrin-riderga ikkinchi marta
 * o'qitish shovqin bo'lardi.
 */
export function RunSpine() {
  const { t } = useT();
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const targets = RUN_STEPS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (!targets.length) return;

    // ⚠️ Observer callback'i FAQAT holati O'ZGARGAN elementlarni beradi,
    // hammasini emas. Shuning uchun ko'rinish holati shu yerda saqlanadi:
    // aks holda "hali ham ko'rinib turgan, lekin bu safar xabar
    // qilinmagan" section hisobdan tushib, belgi noto'g'ri qadamda qolardi
    // (jonli tekshiruvda aynan shu bo'ldi — sahifa tepasida ham ikkinchi
    // qadam yonib turardi).
    const seen = new Map<string, boolean>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        // Ekranning yuqori qismidagi ENG OXIRGI section joriy hisoblanadi —
        // shu bilan uzun section o'rtasida belgi sakramaydi.
        const visible = RUN_STEPS.map((s, i) => (seen.get(s.id) ? i : -1)).filter((i) => i >= 0);
        if (visible.length) setActiveIdx(Math.max(...visible));
      },
      { rootMargin: "-10% 0px -60% 0px", threshold: 0 },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <aside
      aria-hidden
      className="pointer-events-none fixed left-8 top-1/2 z-20 hidden -translate-y-1/2 2xl:block"
    >
      <ol className="relative flex flex-col gap-7 border-l border-border pl-4">
        {RUN_STEPS.map((step, i) => {
          const state = i === activeIdx ? "active" : i < activeIdx ? "past" : "next";
          return (
            <li
              key={step.id}
              data-state={state}
              className="group relative transition-opacity duration-500 data-[state=active]:opacity-100 data-[state=next]:opacity-25 data-[state=past]:opacity-45 motion-reduce:transition-none"
            >
              {/* Chiziqdagi nuqta — faqat joriy qadamda yonadi */}
              <span
                className="absolute -left-[1.3125rem] top-[0.4rem] h-1.5 w-1.5 rounded-full bg-border transition-colors duration-500 group-data-[state=active]:bg-[hsl(var(--cta-strong))] motion-reduce:transition-none"
                aria-hidden
              />
              <span className="block font-mono text-[0.625rem] tabular-nums tracking-[0.14em] text-muted-foreground group-data-[state=active]:text-[hsl(var(--cta-strong))]">
                {step.seq}
              </span>
              <span className="mt-0.5 block font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-muted-foreground">
                {step.event}
              </span>
              <span className="mt-1 block max-w-[9rem] text-[0.6875rem] leading-snug text-foreground/70">
                {t(step.labelKey)}
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
