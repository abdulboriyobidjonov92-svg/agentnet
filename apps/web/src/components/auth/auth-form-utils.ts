export type Method = "email" | "phone";
export type Step = "identify" | "code" | "twofa";

// O'zbekiston raqami: +998 prefiks + 9 ta raqam ("90 123 45 67" ko'rinishida)
export const DIAL_CODE = "+998";
export const formatUzPhone = (digits: string): string => {
  const d = digits.slice(0, 9);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return parts.join(" ");
};

export const RESEND_COOLDOWN_SEC = 60;

export const inputCls =
  "w-full rounded-lg border border-border bg-surface-2 px-3.5 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors";
export const codeInputCls =
  "nums w-full rounded-lg border border-border bg-surface-2 px-3.5 py-3 text-center text-[22px] font-semibold tracking-[0.4em] text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors";
