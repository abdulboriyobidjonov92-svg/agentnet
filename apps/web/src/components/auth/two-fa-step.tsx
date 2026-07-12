"use client";
import { Loader2, ShieldCheck } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { codeInputCls } from "./auth-form-utils";

export function TwoFaStep({
  twoFaCode,
  setTwoFaCode,
  busy,
  onSubmit,
}: {
  twoFaCode: string;
  setTwoFaCode: (v: string) => void;
  busy: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const { t } = useT();

  return (
    <form onSubmit={onSubmit}>
      <label className="filament block">
        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          {t("auth.twoFaLabel")}
        </span>
        <input
          required
          autoFocus
          inputMode="numeric"
          maxLength={6}
          value={twoFaCode}
          onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder={t("auth.twoFaPlaceholder")}
          className={codeInputCls}
        />
      </label>

      <button
        type="submit"
        disabled={busy || twoFaCode.length !== 6}
        className="group mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.twoFaVerifyBtn")}
      </button>
    </form>
  );
}
