"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useApiClient, apiErrorMessage, blockedMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import {
  Sparkles, Loader2, ArrowRight, Check, Bot, ShieldAlert,
  BadgeCheck, Target, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

type LocalizedText = Record<string, string>;

interface RecommendedAgent {
  name: LocalizedText;
  description: LocalizedText;
  system_prompt: string;
  tools: { tool_id: string; config: Record<string, unknown> }[];
}

interface DetectedProfile {
  profession_title: string;
  domain: string;
  domain_label: LocalizedText;
  confidence: number;
  reasoning: string;
  goals: string[];
  method: string;
  recommended_agents: RecommendedAgent[];
  dashboard: { widgets: string[]; quick_actions: LocalizedText[] };
}

function pick(text: LocalizedText | undefined, locale: string): string {
  if (!text) return "";
  return text[locale] ?? text.en ?? Object.values(text)[0] ?? "";
}

export default function OnboardingPage() {
  const api = useApiClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, locale } = useT();

  const [text, setText] = useState("");
  const [city, setCity] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState("");
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [profile, setProfile] = useState<DetectedProfile | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const analyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBlockedReason(null);
    setAnalyzing(true);
    try {
      const res = await api.post<{ profile: DetectedProfile }>("/users/me/onboarding", {
        text: text.trim(),
        language: locale,
        ...(city.trim() ? { city: city.trim() } : {}),
      });
      setProfile(res.profile);
      setSelected(new Set(res.profile.recommended_agents.map((_, i) => i)));
      queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (err: any) {
      // 422 → halal filter bloklagan
      if (err.payload?.blocked) setBlockedReason(err.payload?.reason ?? null);
      else setError(apiErrorMessage(err, t));
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleAgent = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const install = async () => {
    if (!profile) return;
    setInstalling(true);
    setError("");
    try {
      const chosen = profile.recommended_agents.filter((_, i) => selected.has(i));
      const agents = chosen.map((a) => ({
        name: pick(a.name, locale),
        systemPrompt: a.system_prompt,
        toolsConfig: a.tools,
      }));

      let installed: { id: string; name: string }[] = [];
      if (agents.length > 0) {
        installed = await api.post<{ id: string; name: string }[]>(
          "/users/me/recommendations/install",
          { agents },
        );
      }
      queryClient.invalidateQueries({ queryKey: ["agents"] });

      // ⚠️ UI-2 NING YADROSI: oqim BIRINCHI XABARDA tugaydi, dashboard'da EMAS.
      //
      // Ilgari bu yerda `/dashboard` ga o'tilardi va foydalanuvchi agent
      // yaratilgani bilan HECH QANDAY natija ko'rmasdi. PRICING §4 bo'yicha
      // eng ko'p yo'qotiladigan qadam aynan `FIRST AGENT → FIRST SUCCESS` —
      // uni bosib o'tishga majburlash o'rniga, foydalanuvchini to'g'ridan-
      // to'g'ri chat'ga, tayyor birinchi savol bilan olib boramiz.
      const first = installed[0];
      if (first) {
        const starter = pick(chosen[0]?.description, locale) || t("onb.starterFallback");
        router.push(
          `/agents/${first.id}?q=${encodeURIComponent(starter)}&onboarding=1`,
        );
        return;
      }
      router.push("/dashboard");
    } catch (err: any) {
      setError(apiErrorMessage(err, t));
      setInstalling(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* UI-2: qayerdaman? Uch qadam — oxirgisi BIRINCHI NATIJA, "tayyor" emas. */}
      <OnboardingSteps current={profile ? 2 : 1} t={t} />

      {/* Bosqich 1: erkin matnli tavsif */}
      {!profile && (
        <form onSubmit={analyze} className="space-y-5">
          <div className="space-y-2 text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-gold bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
              <Sparkles className="h-3 w-3" /> AgentNet
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{t("onb.title")}</h1>
            <p className="mx-auto max-w-lg text-sm text-muted-foreground">{t("onb.subtitle")}</p>
          </div>

          {blockedReason !== null && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <ShieldAlert className="h-4 w-4 shrink-0" />{" "}
              {blockedMessage(blockedReason, t, { plain: "onb.blocked", withReason: "onb.blockedReason" })}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Textarea
            required
            rows={5}
            minLength={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("onb.placeholder")}
            className="resize-none rounded-2xl bg-card px-5 py-4 shadow-soft"
          />

          <div className="space-y-1.5">
            <label htmlFor="onb-city" className="text-sm font-medium">{t("onb.city")}</label>
            <Input
              id="onb-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t("onb.cityPlaceholder")}
              className="bg-card"
            />
          </div>

          <Button type="submit" size="lg" disabled={analyzing || text.trim().length < 3} className="group w-full">
            {analyzing ? (
              <>
                <Loader2 className="animate-spin" /> {t("onb.analyzing")}
              </>
            ) : (
              <>
                {t("onb.analyze")}
                <ArrowRight className="transition group-hover:translate-x-0.5" />
              </>
            )}
          </Button>

          {/* ⚠️ KAFOLATLANGAN ZAXIRA YO'L (blueprint §2.8 D5).
              1-qadam LLM chaqiruviga tayanadi; bepul tarifda u band bo'lishi
              yoki yiqilishi mumkin (5 modelli rotatsiya tugasa). Bunday
              holatda onboarding TO'XTAB QOLMASLIGI kerak — shablon galereyasi
              LLM'siz ishlaydi va birinchi agent bepul (yaratish narxi
              kechiriladi). */}
          <div className="rounded-2xl border border-dashed p-4 text-center">
            <p className="text-sm font-medium">{t("onb.fallbackTitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("onb.fallbackDesc")}</p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/templates?from=onboarding">
                <BadgeCheck /> {t("onb.fallbackAction")}
              </Link>
            </Button>
          </div>

          <p className="text-center">
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
              {t("onb.skip")}
            </Link>
          </p>
        </form>
      )}

      {/* Bosqich 2: aniqlangan profil + tavsiya agentlar */}
      {profile && (
        <div className="space-y-6 animate-in-up">
          <div className="rounded-2xl border bg-card p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">{t("onb.detectedTitle")}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">{t("onb.profession")}</p>
                <p className="mt-0.5 font-semibold capitalize">{profile.profession_title}</p>
              </div>
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">{t("onb.domain")}</p>
                <p className="mt-0.5 font-semibold">{pick(profile.domain_label, locale)}</p>
              </div>
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">{t("onb.confidence")}</p>
                <p className="mt-0.5 font-semibold">{Math.round(profile.confidence * 100)}%</p>
              </div>
            </div>
            {profile.goals.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Target className="h-3.5 w-3.5" /> {t("onb.goals")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.goals.map((g) => (
                    <span key={g} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              {profile.method === "keyword" ? t("onb.offlineNote") : profile.reasoning}
            </p>
            <button
              onClick={() => {
                setProfile(null);
                setBlockedReason(null);
                setError("");
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <RotateCcw className="h-3 w-3" /> {t("onb.redo")}
            </button>
          </div>

          <div>
            <h3 className="text-lg font-semibold">{t("onb.recommended")}</h3>
            <p className="mb-3 text-sm text-muted-foreground">{t("onb.recommendedSub")}</p>
            <div className="space-y-2">
              {profile.recommended_agents.map((agent, i) => {
                const checked = selected.has(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleAgent(i)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
                      checked ? "border-primary bg-primary/5" : "hover:bg-muted",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{pick(agent.name, locale)}</p>
                      <p className="text-sm text-muted-foreground">{pick(agent.description, locale)}</p>
                    </div>
                    {checked && <Check className="h-5 w-5 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button size="lg" onClick={install} disabled={installing} className="w-full">
            {installing ? (
              <>
                <Loader2 className="animate-spin" /> {t("onb.installing")}
              </>
            ) : (
              <>
                {t("onb.install")} ({selected.size})
                <ArrowRight />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * UI-2 — uch qadamli progress.
 *
 * Uchinchi qadam ataylab "Tayyor" EMAS, balki "Birinchi natija": onboarding
 * agent yaratilganda tugamaydi — u foydalanuvchi haqiqiy javobni ko'rganda
 * tugaydi (PRICING §4, eng ko'p yo'qotiladigan qadam).
 */
function OnboardingSteps({ current, t }: { current: 1 | 2 | 3; t: (k: string) => string }) {
  const steps = [t("onb.step1"), t("onb.step2"), t("onb.step3")];
  return (
    <ol className="flex items-center gap-2" aria-label={t("onb.progressLabel")}>
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                done && "border-transparent bg-ok/15 text-ok",
                active && "border-transparent bg-primary text-primary-foreground",
                !done && !active && "text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3 w-3" /> : n}
            </span>
            <span
              className={cn(
                "hidden truncate text-xs sm:block",
                active ? "font-medium" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {n < 3 && <span className="h-px flex-1 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
