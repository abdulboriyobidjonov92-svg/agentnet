"use client";
import { Loader2, ArrowRight, Mail, Phone } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { GoogleGlyph } from "./google-glyph";
import { DIAL_CODE, formatUzPhone, inputCls, type Method } from "./auth-form-utils";

export function IdentifyStep({
  isSignUp,
  method,
  onMethodChange,
  name,
  setName,
  email,
  setEmail,
  phoneDigits,
  setPhoneDigits,
  phoneValid,
  canSubmitIdentify,
  busy,
  onSubmit,
}: {
  isSignUp: boolean;
  method: Method;
  onMethodChange: (m: Method) => void;
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  phoneDigits: string;
  setPhoneDigits: (v: string) => void;
  phoneValid: boolean;
  canSubmitIdentify: boolean;
  busy: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const { t } = useT();

  return (
    <form onSubmit={onSubmit}>
      {/* Google — hozircha nofaol, chalg'ituvchi soxta OAuth o'rniga halol holat */}
      <button
        type="button"
        disabled
        title={t("auth.googleSoonHint")}
        className="flex w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm font-medium text-muted-foreground opacity-60"
      >
        <GoogleGlyph />
        {t("auth.googleSoon")}
      </button>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
          {t("auth.or")}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Segmented control — Email / Telefon (Filament active) */}
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-2 p-1">
        {([
          { k: "email" as Method, icon: Mail, label: t("auth.methodEmail") },
          { k: "phone" as Method, icon: Phone, label: t("auth.methodPhone") },
        ]).map(({ k, icon: Icon, label }) => {
          const active = method === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onMethodChange(k)}
              aria-pressed={active}
              className={`relative flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-surface-1 text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {active && <span className="absolute inset-x-3 -bottom-px h-px bg-line" />}
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {isSignUp && (
          <label className="filament block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("auth.name")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("auth.namePlaceholder")}
              className={inputCls}
            />
          </label>
        )}

        {method === "email" ? (
          <label className="filament block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("auth.email")}</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
              className={inputCls}
            />
          </label>
        ) : (
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("auth.phone")}</span>
            <div className="filament flex items-stretch overflow-hidden rounded-lg border border-border bg-surface-2 focus-within:border-[hsl(var(--accent-line)/0.75)]">
              <span className="flex select-none items-center gap-2 border-r border-border bg-surface-3 px-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">UZ</span>
                <span className="nums text-[15px] font-medium tracking-tight text-foreground">{DIAL_CODE}</span>
              </span>
              <input
                required
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={formatUzPhone(phoneDigits)}
                onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder={t("auth.phonePlaceholder")}
                className="nums w-full bg-transparent px-3.5 py-3 text-[15px] tracking-wide text-foreground placeholder:text-muted-foreground/60 outline-none"
              />
            </div>
            {phoneDigits.length > 0 && !phoneValid && (
              <span className="mt-1.5 block text-xs text-muted-foreground/70">{t("auth.phoneInvalid")}</span>
            )}
          </label>
        )}
      </div>

      <button
        type="submit"
        disabled={busy || !canSubmitIdentify}
        className="group mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {t("auth.sendCodeBtn")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>
    </form>
  );
}
