"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowRight, ArrowLeft, Mail, Phone, ShieldCheck } from "lucide-react";
import { useT } from "@/lib/i18n/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
// Google Identity Services — client ID bo'lmasa Google tugmasi umuman
// ko'rsatilmaydi (soxta/ishlamaydigan tugma o'rniga halol holat).
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type Method = "email" | "phone";
type Step = "identify" | "code" | "twofa";

// O'zbekiston raqami: +998 prefiks + 9 ta raqam ("90 123 45 67" ko'rinishida)
const DIAL_CODE = "+998";
const formatUzPhone = (digits: string): string => {
  const d = digits.slice(0, 9);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return parts.join(" ");
};

const RESEND_COOLDOWN_SEC = 60;

// Google'ning rasmiy 4-rangli "G" belgisi (brend aktivi — monoxrom istisno)
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] opacity-50" aria-hidden>
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
  const [step, setStep] = useState<Step>("identify");
  const [method, setMethod] = useState<Method>("email");
  const [email, setEmail] = useState("");
  const [phoneDigits, setPhoneDigits] = useState(""); // faqat raqamlar (prefikssiz)
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  // Referral kodi (?ref=KOD) — signup'da serverga uzatiladi, ikkala tomon bonus oladi
  const [refCode, setRefCode] = useState<string | null>(null);
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setRefCode(ref);
  }, []);

  const isSignUp = mode === "sign-up";
  const phoneValid = phoneDigits.length === 9;
  const canSubmitIdentify = method === "email" ? email.includes("@") : phoneValid;
  const identifierPayload = method === "email" ? { email: email.trim() } : { phone: `${DIAL_CODE}${phoneDigits}` };
  const identifierLabel = method === "email" ? email.trim() : `${DIAL_CODE} ${formatUzPhone(phoneDigits)}`;

  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => {
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SEC);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1 && cooldownTimer.current) clearInterval(cooldownTimer.current);
        return Math.max(0, c - 1);
      });
    }, 1000);
  };

  const finishLogin = async (data: {
    userId: string;
    email: string;
    phone?: string | null;
    name?: string | null;
    token: string;
    isNewUser?: boolean;
  }) => {
    // Token httpOnly cookie'ga FAQAT server tomonda yoziladi (XSS o'g'irlay
    // olmasligi uchun) — shu route ikkala cookie'ni (token + profil) o'rnatadi.
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: data.userId,
        email: data.email,
        phone: data.phone ?? undefined,
        name: data.name || name.trim() || undefined,
        token: data.token,
      }),
    });
    if (!res.ok) throw new Error("Sessiyani o'rnatib bo'lmadi — qayta urinib ko'ring");
    router.push(isSignUp || data.isNewUser ? "/onboarding" : "/dashboard");
    router.refresh();
  };

  // --- Google bilan kirish (Google Identity Services) ---
  const googleBtnRef = useRef<HTMLDivElement | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  // GIS callback komponent hayoti davomida bir marta ro'yxatdan o'tadi, lekin
  // ichida eng SO'NGGI finishLogin/refCode kerak — shuning uchun ref orqali.
  const googleHandlerRef = useRef<(credential: string) => void>(() => {});

  googleHandlerRef.current = async (credential: string) => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Google orqali kirib bo'lmadi");
      if (data.needsTwoFactor) {
        setUserId(data.userId);
        setStep("twofa");
        setTwoFaCode("");
      } else {
        await finishLogin(data);
      }
    } catch (err: any) {
      setError(err.message || "Google orqali kirib bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || step !== "identify") return;

    let cancelled = false;
    const render = () => {
      const g = (window as any).google;
      const host = googleBtnRef.current;
      if (cancelled || !g?.accounts?.id || !host) return;
      try {
        // Effect qayta ishga tushsa (masalan step o'zgarib qaytsa) GIS yana
        // bitta tugma qo'shib qo'ymasligi uchun konteynerni tozalaymiz.
        // Bu tugunlar GIS'niki — React ularni kuzatmaydi, xavfsiz.
        host.innerHTML = "";
        g.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (resp: { credential?: string }) => {
            if (resp?.credential) googleHandlerRef.current(resp.credential);
          },
        });
        g.accounts.id.renderButton(host, {
          theme: "filled_black",
          size: "large",
          width: 320,
          text: isSignUp ? "signup_with" : "signin_with",
        });
        setGoogleReady(true);
      } catch {
        // GIS yuklanmasa yoki origin ruxsat etilmagan bo'lsa — Google
        // tugmasisiz davom etamiz (email/telefon baribir ishlaydi).
        setGoogleReady(false);
      }
    };

    if ((window as any).google?.accounts?.id) {
      render();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.getElementById("gis-script") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", render);
      return () => {
        cancelled = true;
        existing.removeEventListener("load", render);
      };
    }

    const s = document.createElement("script");
    s.id = "gis-script";
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = render;
    document.head.appendChild(s);
    return () => {
      cancelled = true;
    };
  }, [step, isSignUp]);

  const requestCode = async () => {
    if (!canSubmitIdentify || busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(identifierPayload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Error");
      setStep("code");
      setCode("");
      startCooldown();
    } catch (err: any) {
      setError(err.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  const submitIdentify = (e: React.FormEvent) => {
    e.preventDefault();
    requestCode();
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...identifierPayload, code, name: name.trim() || undefined, ref: refCode || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Error");
      if (data.needsTwoFactor) {
        setUserId(data.userId);
        setStep("twofa");
        setTwoFaCode("");
      } else {
        await finishLogin(data);
      }
    } catch (err: any) {
      setError(err.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  const submitTwoFa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (twoFaCode.length !== 6 || busy || !userId) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/2fa/login-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, token: twoFaCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Error");
      await finishLogin(data);
    } catch (err: any) {
      setError(err.message || "Error");
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    setError("");
    setStep("identify");
    setCode("");
  };

  const inputCls =
    "w-full rounded-lg border border-border bg-surface-2 px-3.5 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors";
  const codeInputCls =
    "nums w-full rounded-lg border border-border bg-surface-2 px-3.5 py-3 text-center text-[22px] font-semibold tracking-[0.4em] text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors";

  return (
    <div className="w-full animate-in-up">
      {/* Editorial sarlavha — oversized, chapga tekislangan */}
      <div className="mb-8">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {step !== "identify" ? t("auth.verifyBadge") : isSignUp ? t("auth.startBadge") : t("auth.welcomeBadge")}
        </p>
        <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-tight">
          {step === "twofa"
            ? t("auth.twoFaTitle")
            : step === "code"
              ? t("auth.otpTitle")
              : isSignUp
                ? t("auth.signUpTitle")
                : t("auth.signInTitle")}
        </h1>
        <div className="mt-4 h-px w-10 origin-left bg-line draw-x" />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {step === "twofa"
            ? t("auth.twoFaSub")
            : step === "code"
              ? t("auth.otpSentTo").replace("{identifier}", identifierLabel)
              : isSignUp
                ? t("auth.signUpSub")
                : t("auth.signInSub")}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {step === "identify" && (
        <form onSubmit={submitIdentify}>
          {/* Google — client ID sozlangan bo'lsa GIS chizadi; sozlanmagan
              bo'lsa soxta tugma o'rniga halol "tez orada" holati. */}
          {GOOGLE_CLIENT_ID ? (
            // MUHIM: GIS tugmani DOM'ga O'ZI joylashtiradi. Shu sabab
            // konteyner yonida SHARTLI (mount/unmount bo'ladigan) element
            // bo'lmasligi kerak — React uni o'chirmoqchi bo'lganda GIS
            // qo'shgan tugunlar bilan to'qnashib "removeChild" xatosi beradi
            // (butun sahifa qulaydi). Shuning uchun ikkala element ham DOIM
            // mount holatida, faqat CSS bilan yashiriladi.
            <div className="flex min-h-[44px] items-center justify-center">
              {/* GIS shu konteynerga o'z tugmasini chizadi — React uning
                  ichidagi tugunlarga TEGMAYDI (React bolasi yo'q). */}
              <div ref={googleBtnRef} />
              <div
                aria-hidden={googleReady}
                className={
                  googleReady
                    ? "hidden"
                    : "flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm font-medium text-muted-foreground opacity-60"
                }
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Google
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled
              title={t("auth.googleSoonHint")}
              className="flex w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm font-medium text-muted-foreground opacity-60"
            >
              <GoogleGlyph />
              {t("auth.googleSoon")}
            </button>
          )}

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
      )}

      {step === "code" && (
        <form onSubmit={submitCode}>
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
              onClick={goBack}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("auth.otpBack")}
            </button>
            <button
              type="button"
              disabled={cooldown > 0 || busy}
              onClick={requestCode}
              className="text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              {cooldown > 0 ? `${t("auth.otpResend")} (${cooldown}s)` : t("auth.otpResend")}
            </button>
          </div>
        </form>
      )}

      {step === "twofa" && (
        <form onSubmit={submitTwoFa}>
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
      )}

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
    </div>
  );
}
