"use client";
import { Loader2, ArrowLeft } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { codeInputCls } from "./auth-form-utils";

export function CodeStep({
  code,
  setCode,
  busy,
  cooldown,
  onSubmit,
  onBack,
  onResend,
}: {
  code: string;
  setCode: (v: string) => void;
  busy: boolean;
  cooldown: number;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  onResend: () => void;
}) {
  const { t } = useT();

  return (
    <form onSubmit={onSubmit}>
      <label className="filament block">
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t("auth.otpCodeLabel")}</span>
        <input
          required
          autoFocus
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder={t("auth.otpCodePlaceholder")}
          className={codeInputCls}
        />
      </label>

      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="group mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.otpVerifyBtn")}
      </button>

      <div className="mt-4 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("auth.otpBack")}
        </button>
        <button
          type="button"
          disabled={cooldown > 0 || busy}
          onClick={onResend}
          className="text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          {cooldown > 0 ? `${t("auth.otpResend")} (${cooldown}s)` : t("auth.otpResend")}
        </button>
      </div>
    </form>
  );
}
