"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import {
  Bot, MessageSquare, Sparkles, ArrowUpRight, Plus,
  UserRound, Zap, Loader2, CircleUserRound, X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/components/ui/toast";
import { StatTile, type Accent } from "@/components/charts/charts";

// 3D sahnalar — faqat klientda, sahifa yuklanishini bloklamaydi
const PersonalOrb = dynamic(() => import("@/components/three/personal-orb"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-breathe rounded-full bg-primary/5 blur-3xl" />,
});
const RoleScene = dynamic(() => import("@/components/three/role-scene"), { ssr: false });

type LocalizedText = Record<string, string>;

function pick(text: LocalizedText | undefined, locale: string): string {
  if (!text) return "";
  return text[locale] ?? text.en ?? Object.values(text)[0] ?? "";
}

interface Me {
  id: string;
  email: string;
  professionTitle?: string | null;
  domain?: string | null;
  onboardingCompleted: boolean;
  profileData?: {
    domain_label?: LocalizedText;
    quick_actions?: LocalizedText[];
    widgets?: string[];
  } | null;
  goals?: string[] | null;
}

interface RecommendedAgent {
  name: LocalizedText;
  description: LocalizedText;
  system_prompt: string;
  tools: { tool_id: string; config: Record<string, unknown> }[];
  installed: boolean;
}

export default function DashboardPage() {
  const api = useApiClient();
  const { t, locale } = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [installingIdx, setInstallingIdx] = useState<number | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  const [orbPanel, setOrbPanel] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<Me>("/users/me"),
  });
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.get<{ agentCount: number; conversationCount: number }>("/users/me/stats"),
  });
  const { data: agents, isLoading: agentsLoading, isError: agentsError, refetch: refetchAgents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<any[]>("/agents"),
  });
  const { data: recs } = useQuery({
    queryKey: ["recommendations", me?.domain],
    queryFn: () => api.get<{ recommended_agents: RecommendedAgent[] }>("/users/me/recommendations"),
    enabled: !!me?.onboardingCompleted,
  });

  const installAgent = async (agent: RecommendedAgent, idx: number) => {
    setInstallingIdx(idx);
    setInstallError(null);
    try {
      await api.post("/users/me/recommendations/install", {
        agents: [
          {
            name: pick(agent.name, locale),
            systemPrompt: agent.system_prompt,
            toolsConfig: agent.tools,
          },
        ],
      });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: t("dash.installedAgent"), description: pick(agent.name, locale) });
    } catch (e) {
      setInstallError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setInstallingIdx(null);
    }
  };

  const openQuickAction = (prompt: string) => {
    if (agents?.length) {
      router.push(`/agents/${agents[0].id}?q=${encodeURIComponent(prompt)}`);
    } else {
      router.push("/onboarding");
    }
  };

  const agentCount = stats?.agentCount ?? 0;
  const convCount = stats?.conversationCount ?? 0;

  // Faqat haqiqiy, serverdan kelgan ko'rsatkichlar — uydirma trend/foizlar yo'q
  const tiles: { label: string; value: string | number; icon: any; accent: Accent }[] = [
    { label: t("dash.statAgents"), value: agentCount, icon: Bot, accent: "cyan" },
    { label: t("dash.statConversations"), value: convCount, icon: MessageSquare, accent: "emerald" },
  ];

  const domainLabel = pick(me?.profileData?.domain_label, locale);
  const quickActions = me?.profileData?.quick_actions ?? [];
  const uninstalledRecs = (recs?.recommended_agents ?? []).filter((a) => !a.installed);

  return (
    <div className="space-y-6">
      {/* Onboarding banner — profil hali sozlanmagan bo'lsa */}
      {me && !me.onboardingCompleted && (
        <Reveal>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gold/40 bg-gold/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/20 text-gold">
                <UserRound className="h-5 w-5" />
              </div>
              <p className="max-w-xl text-sm font-medium">{t("dash.onbBanner")}</p>
            </div>
            <Button asChild>
              <Link href="/onboarding">
                <Sparkles /> {t("dash.onbBannerBtn")}
              </Link>
            </Button>
          </div>
        </Reveal>
      )}

      {/* Hero — Personal Orb (Life Twin langari) + agentlar orbitasi */}
      <div className="relative overflow-hidden rounded-[1.75rem] glass-panel shadow-glow">
        <div className="absolute inset-0 aurora opacity-60" />
        <div className="relative grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Matnli qism */}
          <div className="z-10 p-6 sm:p-8">
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              {me?.onboardingCompleted && domainLabel ? domainLabel : t("brand.tagline")}
            </p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
              {t("dash.greeting")}
              {me?.professionTitle ? (
                <span className="text-gradient"> · {me.professionTitle}</span>
              ) : ""} 👋
            </h1>
            <p className="mt-1 max-w-md text-muted-foreground">{t("dash.subtitle")}</p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/agents/new">
                  <Plus /> {t("nav.newAgent")}
                </Link>
              </Button>
              {me?.onboardingCompleted && (
                <Link
                  href="/onboarding"
                  className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                >
                  {t("dash.editProfile")}
                </Link>
              )}
            </div>

            {/* Orb bosilganda: agentlar holati paneli */}
            {orbPanel && (
              <div className="mt-5 animate-in-up rounded-2xl border bg-background/40 p-4 backdrop-blur">
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <CircleUserRound className="h-4 w-4 text-primary" /> {t("dash.orbStatus")}
                  </p>
                  <button
                    onClick={() => setOrbPanel(false)}
                    aria-label={t("common.cancel")}
                    className="hit-target text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <OrbStat value={agentCount} label={t("dash.statAgents")} />
                  <OrbStat value={me?.profileData?.widgets?.length ?? 0} label={t("dash.orbWidgets")} />
                  <OrbStat value={convCount} label={t("dash.statConversations")} />
                </div>
              </div>
            )}
          </div>

          {/* 3D Personal Orb */}
          <div className="relative h-64 sm:h-72 lg:h-auto lg:min-h-[300px]">
            <PersonalOrb
              agents={(agents ?? []).map((a: any) => ({ id: a.id, name: a.name }))}
              onSelectAgent={(id) => router.push(`/agents/${id}`)}
              onOrbClick={() => setOrbPanel((v) => !v)}
              className="!absolute !inset-0"
            />
            {/* Rol-moslashuvchi mini-sahna — kasbga qarab morflanadi */}
            {me?.onboardingCompleted && me?.domain && (
              <div className="pointer-events-none absolute bottom-2 right-2 h-24 w-28 opacity-90">
                <RoleScene domain={me.domain} className="!h-full !w-full" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tezkor amallar — kasbga mos namuna promptlar */}
      {me?.onboardingCompleted && quickActions.length > 0 && (
        <Reveal>
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <Zap className="h-4 w-4 text-gold" /> {t("dash.quickActionsTitle")}
            </h2>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((qa, i) => {
                const label = pick(qa, locale);
                return (
                  <button
                    key={i}
                    onClick={() => openQuickAction(label)}
                    className="rounded-full border bg-background px-4 py-2 text-sm font-medium transition hover:border-primary hover:bg-primary/5 hover:text-primary"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>
      )}

      {/* Operatsion ko'rsatkichlar — faqat haqiqiy hisoblar */}
      <div className="grid gap-3 sm:grid-cols-2">
        {statsLoading
          ? [0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl border bg-card" />)
          : tiles.map((s, i) => (
              <Reveal key={s.label} delay={i * 60}>
                <StatTile
                  label={s.label}
                  value={s.value}
                  accent={s.accent}
                  icon={<s.icon className="h-4 w-4" />}
                />
              </Reveal>
            ))}
      </div>

      {/* Siz uchun tavsiya agentlar — kasbga moslashgan */}
      {uninstalledRecs.length > 0 && (
        <Reveal>
          <div>
            <h2 className="mb-4 text-xl font-semibold">{t("dash.recommendedForYou")}</h2>
            {installError && (
              <p role="alert" className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {installError}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {uninstalledRecs.map((agent, i) => (
                <div key={i} className="flex flex-col rounded-2xl border border-dashed border-primary/40 bg-primary/[0.03] p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Bot className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold">{pick(agent.name, locale)}</h3>
                  <p className="mt-1 flex-1 text-xs text-muted-foreground">{pick(agent.description, locale)}</p>
                  <Button
                    size="sm"
                    onClick={() => installAgent(agent, i)}
                    disabled={installingIdx !== null}
                    className="mt-4 w-full"
                  >
                    {installingIdx === i ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <>
                        <Plus /> {t("dash.installAgent")}
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {/* Agents */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t("dash.recentAgents")}</h2>
          <Link href="/agents" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            {t("nav.agents")} <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {agentsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl border bg-card" />
            ))}
          </div>
        ) : agentsError ? (
          <ErrorState onRetry={() => refetchAgents()} />
        ) : !agents?.length ? (
          <div className="rounded-2xl border border-dashed p-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Bot className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">{t("dash.noAgents")}</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{t("dash.noAgentsDesc")}</p>
            <Button asChild className="mt-5">
              <Link href="/agents/new">
                <Plus /> {t("dash.createFirst")}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.slice(0, 6).map((agent: any) => (
              <Link key={agent.id} href={`/agents/${agent.id}`} className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-soft transition hover:shadow-lift">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:scale-110">
                    <Bot className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </div>
                <h3 className="truncate font-semibold">{agent.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{agent.systemPrompt}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrbStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border bg-background/40 px-2 py-2">
      <p className="text-xl font-bold text-primary">{value}</p>
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
