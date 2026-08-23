import { RUN_STEPS } from "./run-steps";

/**
 * Section tepasidagi ijro belgisi: `002 · POLICY_CHECK`.
 *
 * Bu — sahifadagi yagona "eyebrow" tizimi. U bezak emas: raqam ijro
 * ichidagi tartibni, matn esa hodisa turini bildiradi (`run-steps.ts`).
 *
 * Chapdagi rail faqat juda keng ekranda ko'rinadi; bu belgi esa HAMMA
 * o'lchamda turadi, ya'ni tuzilma telefonda ham yo'qolmaydi.
 */
export function SectionMark({ id, t }: { id: string; t: (key: string) => string }) {
  const step = RUN_STEPS.find((s) => s.id === id);
  if (!step) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-muted-foreground">
      <span className="tabular-nums text-[hsl(var(--violet-text))]">{step.seq}</span>
      <span className="h-px w-4 bg-border" aria-hidden />
      <span>{step.event}</span>
      <span className="normal-case tracking-normal text-muted-foreground/70">
        {t(step.labelKey)}
      </span>
    </p>
  );
}
