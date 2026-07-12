"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setClientSession } from "@/lib/session";
import { useT } from "@/lib/i18n/client";
import { IdentifyStep } from "./identify-step";
import { CodeStep } from "./code-step";
import { TwoFaStep } from "./two-fa-step";
import { DIAL_CODE, RESEND_COOLDOWN_SEC, formatUzPhone, type Method, type Step } from "./auth-form-utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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

  const finishLogin = (data: {
    userId: string;
    email: string;
    phone?: string | null;
    name?: string | null;
    token: string;
    isNewUser?: boolean;
  }) => {
    setClientSession({
      userId: data.userId,
      email: data.email,
      phone: data.phone ?? undefined,
      name: data.name || name.trim() || undefined,
      token: data.token,
    });
    router.push(isSignUp || data.isNewUser ? "/onboarding" : "/dashboard");
    router.refresh();
  };

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
        finishLogin(data);
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
      finishLogin(data);
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
        <IdentifyStep
          isSignUp={isSignUp}
          method={method}
          onMethodChange={(m) => {
            setMethod(m);
            setError("");
          }}
          name={name}
          setName={setName}
          email={email}
          setEmail={setEmail}
          phoneDigits={phoneDigits}
          setPhoneDigits={setPhoneDigits}
          phoneValid={phoneValid}
          canSubmitIdentify={canSubmitIdentify}
          busy={busy}
          onSubmit={submitIdentify}
        />
      )}

      {step === "code" && (
        <CodeStep
          code={code}
          setCode={setCode}
          busy={busy}
          cooldown={cooldown}
          onSubmit={submitCode}
          onBack={goBack}
          onResend={requestCode}
        />
      )}

      {step === "twofa" && (
        <TwoFaStep twoFaCode={twoFaCode} setTwoFaCode={setTwoFaCode} busy={busy} onSubmit={submitTwoFa} />
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
