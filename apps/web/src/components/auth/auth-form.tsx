"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowRight, Mail, Phone } from "lucide-react";
import { setClientSession } from "@/lib/session";
import { useT } from "@/lib/i18n/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Method = "email" | "phone";
type Pending = "form" | "google" | null;

// O'zbekiston raqami: +998 prefiks + 9 ta raqam ("90 123 45 67" ko'rinishida)
const DIAL_CODE = "+998";
const formatUzPhone = (digits: string): string => {
  const d = digits.slice(0, 9);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return parts.join(" ");
};

// Google'ning rasmiy 4-rangli "G" belgisi (brend aktivi — monoxrom istisno)
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const { t } = useT();
  const [method, setMethod] = useState<Method>("email");
  const [email, setEmail] = useState("");
  const [phoneDigits, setPhoneDigits] = useState(""); // faqat raqamlar (prefikssiz)
  const [name, setName] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState("");

  const isSignUp = mode === "sign-up";
  const phoneValid = phoneDigits.length === 9;
  const canSubmit = method === "email" ? email.includes("@") : phoneValid;
  const busy = pending !== null;

  // Umumiy autentifikatsiya oqimi — email / telefon / Google uchun bitta yo'l.
  const authenticate = async (
    payload: { email?: string; phone?: string; name?: string },
    who: Exclude<Pending, null>,
  ) => {
    setError("");
    setPending(who);
    try {
      const res = await fetch(`${API_URL}/api/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Error");
      }
      const data = await res.json();
      const isNew = data.isNewUser ?? false;
      setClientSession({
        userId: data.userId,
        email: data.email,
        phone: data.phone ?? undefined,
        name: data.name || payload.name || undefined,
        token: data.token,
      });
      // Yangi hisob → adaptiv onboarding; mavjud hisob → dashboard
      router.push(isSignUp || isNew ? "/onboarding" : "/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error");
      setPending(null);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    authenticate(
      method === "email"
        ? { email: email.trim(), name: name.trim() }
        : { phone: `${DIAL_CODE}${phoneDigits}`, name: name.trim() },
      "form",
    );
  };

  const googleLogin = () => {
    if (busy) return;
    // Demo rejimi: Clerk/OAuth kredensiallarisiz — barqaror demo Google hisobi.
    authenticate({ email: "demo.google@agentnet.app", name: "Google User" }, "google");
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

      {/* Google — birlamchi ijtimoiy kirish */}
      <button
        type="button"
        onClick={googleLogin}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm font-medium text-foreground shadow-soft transition hover:bg-surface-2 disabled:opacity-40"
      >
        {pending === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleGlyph />}
        {t("auth.google")}
      </button>

      {/* "yoki" ajratgich — hairline */}
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
              onClick={() => {
                setMethod(k);
                setError("");
              }}
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
              {/* +998 prefiks chip — UZ (bayroq emoji Windows'da renderlanmaydi) */}
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

      {/* Asosiy amal — rang bilan emas, yorug'lik (near-white) bilan */}
      <button
        type="submit"
        disabled={busy || !canSubmit}
        className="group mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90 disabled:opacity-40"
      >
        {pending === "form" ? (
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
