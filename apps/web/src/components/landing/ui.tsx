import type { ReactNode } from "react";

/**
 * V5 LANDING — UMUMIY DIZAYN QATLAMI.
 *
 * Bu fayl sahifadagi HAR BIR bo'lim uchun yagona qoidani beradi: karta
 * qanday ko'rinadi, sarlavha bloki qanday tuziladi. Ilgari har bo'lim
 * o'z chegara/soya/masofasini yozardi va ular asta-sekin bir-biridan
 * uzoqlashardi.
 *
 * KARTA MATERIALI: qora fon ustida yupqa oq qirra + yuqoridan pastga
 * so'nuvchi och to'ldirish. Chuqurlik SOYA bilan emas, YORUG'LIK bilan
 * beriladi (yuqori qirra yorug', pastki quyuq) — shu sababli kartalar
 * "yopishtirilgan" emas, "yoritilgan" ko'rinadi.
 */

/** Bo'lim sarlavhasi: eyebrow + katta sarlavha + qisqa tavsif. */
export function SectionHead({
  eyebrow,
  title,
  sub,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  align?: "center" | "left";
}) {
  const centered = align === "center";
  return (
    <div className={centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-[hsl(220_95%_76%)]">
        {eyebrow}
      </p>
      <h2 className="mt-4 font-display text-[clamp(1.625rem,3vw,2.375rem)] font-semibold leading-[1.08] tracking-[-0.035em] text-white">
        {title}
      </h2>
      {sub ? (
        <p
          className={`mt-4 text-[0.9375rem] leading-relaxed text-white/55 sm:text-base ${
            centered ? "mx-auto max-w-xl" : ""
          }`}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Karta — sahifadagi yagona sirt.
 * `glow` faqat urg'u kerak bo'lgan kartada (masalan tanlangan tarif).
 */
export function GlowCard({
  children,
  className = "",
  glow = false,
  interactive = true,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  interactive?: boolean;
}) {
  return (
    <div
      className={[
        "relative rounded-2xl border bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-6 sm:p-7",
        glow
          ? "border-[hsl(232_100%_72%/0.45)] shadow-[inset_0_1px_0_hsl(220_100%_90%/0.14),0_0_60px_-12px_hsl(232_100%_60%/0.55)]"
          : "border-white/[0.08] shadow-[inset_0_1px_0_hsl(220_100%_90%/0.08),0_24px_60px_-28px_rgba(0,0,0,0.9)]",
        interactive
          ? "transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-[hsl(228_100%_76%/0.4)] hover:shadow-[inset_0_1px_0_hsl(220_100%_90%/0.14),0_0_50px_-16px_hsl(230_100%_62%/0.5)] motion-reduce:hover:translate-y-0 motion-reduce:transition-none"
          : "",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/** Ikon uchun kvadrat chip — kartalarning yuqori chap burchagida. */
export function IconChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[hsl(225_90%_78%/0.28)] bg-[hsl(228_70%_16%/0.8)] text-[hsl(215_95%_86%)] shadow-[inset_0_1px_0_hsl(220_100%_90%/0.12)]">
      {children}
    </span>
  );
}

/** Bo'lim qobig'i — bir xil vertikal ritm va maksimal kenglik. */
export function Section({
  id,
  labelledBy,
  children,
  tinted = false,
  className = "",
}: {
  id: string;
  labelledBy?: string;
  children: ReactNode;
  /** Ozgina yorug'roq fon — bo'limlar ketma-ket kelganda ritm hosil qiladi. */
  tinted?: boolean;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`border-b border-white/[0.06] ${tinted ? "bg-white/[0.015]" : ""} ${className}`}
    >
      <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24">{children}</div>
    </section>
  );
}
