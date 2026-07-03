"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowRight } from "lucide-react";
import { setClientSession } from "@/lib/session";
import { useT } from "@/lib/i18n/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isSignUp = mode === "sign-up";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Error");
      }
      const data = await res.json();
      setClientSession({ userId: data.userId, email: data.email, name: name.trim() });
      // Yangi hisob → adaptiv onboarding; mavjud hisob → dashboard
      router.push(isSignUp ? "/onboarding" : "/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error");
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-border bg-surface-2 px-3.5 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors";

  return (
    <form onSubmit={submit} className="w-full animate-in-up">
      {/* Editorial sarlavha — oversized, chapga tekislangan */}
      <div className="mb-8">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {isSignUp ? t("auth.startBadge") : t("auth.welcomeBadge")}
        </p>
        <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-tight">
          {isSignUp ? t("auth.signUpTitle") : t("auth.signInTitle")}
        </h1>
        {/* Imzo: sarlavha ostida chizilib keluvchi arctic hairline */}
        <div className="mt-4 h-px w-10 origin-left bg-line draw-x" />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {isSignUp ? t("auth.signUpSub") : t("auth.signInSub")}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

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
      </div>

      {/* Asosiy amal — rang bilan emas, yorug'lik (near-white) bilan */}
      <button
        type="submit"
        disabled={loading || !email}
        className="group mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-40"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {isSignUp ? t("auth.signUpBtn") : t("auth.signInBtn")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>

      <p className="mt-8 text-sm text-muted-foreground">
        {isSignUp ? t("auth.haveAccount") : t("auth.noAccount")}{" "}
        <Link
          href={isSignUp ? "/sign-in" : "/sign-up"}
          className="font-medium text-foreground underline decoration-line decoration-1 underline-offset-4 hover:decoration-foreground"
        >
          {isSignUp ? t("auth.signInBtn") : t("auth.signUpBtn")}
        </Link>
      </p>

      <p className="mt-3 text-xs text-muted-foreground/60">{t("auth.demoNote")}</p>
    </form>
  );
}
