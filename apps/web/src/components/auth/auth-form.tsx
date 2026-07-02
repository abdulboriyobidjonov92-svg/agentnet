"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowRight, Sparkles } from "lucide-react";
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

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-5 animate-in-up">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-gold bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
          <Sparkles className="h-3 w-3" />
          {isSignUp ? t("auth.startBadge") : t("auth.welcomeBadge")}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {isSignUp ? t("auth.signUpTitle") : t("auth.signInTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isSignUp ? t("auth.signUpSub") : t("auth.signInSub")}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {isSignUp && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("auth.name")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("auth.namePlaceholder")}
            className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t("auth.email")}</label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("auth.emailPlaceholder")}
          className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !email}
        className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-lift transition hover:brightness-110 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {isSignUp ? t("auth.signUpBtn") : t("auth.signInBtn")}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </>
        )}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? t("auth.haveAccount") : t("auth.noAccount")}{" "}
        <Link
          href={isSignUp ? "/sign-in" : "/sign-up"}
          className="font-semibold text-primary hover:underline"
        >
          {isSignUp ? t("auth.signInBtn") : t("auth.signUpBtn")}
        </Link>
      </p>

      <p className="text-center text-xs text-muted-foreground/70">{t("auth.demoNote")}</p>
    </form>
  );
}
