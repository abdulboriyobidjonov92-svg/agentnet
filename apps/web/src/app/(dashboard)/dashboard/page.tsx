"use client";
// BOSHQARUV — "The Morph": moslashuvchan bento to'ri.
// Raqamlar yo'q: agentlar — porlovchi shar, suhbatlar — puls, harakat — daryo.
// Katak fokus olsa, tirik hujayra kabi o'sadi va qolganlarini surib qo'yadi
// (grid trek o'lchamlari o'zgaradi, framer-motion layout FLIP silliqlaydi).
// Foydalanuvchi to'xtasa — interfeys "nafas oladi" (drift).

import { useEffect, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Loader2, Plus, X } from "lucide-react";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { LiquidCard } from "@/components/neuro/liquid-card";
import { Magnetic } from "@/components/neuro/magnetic";
import { Awakening } from "@/components/neuro/awakening";
import { GlowOrb, FlowRiver, PulseRings } from "@/components/neuro/living";
import { useIdle } from "@/components/neuro/use-idle";

// Yadro — faqat klientda; yuklanayotganda nafas oluvchi nur qoladi
const NeuroCore = dynamic(() => import("@/components/neuro/neuro-core"), {
  ssr: false,
  loading: () => (
    <div className="animate-breathe m-auto h-1/2 w-1/2 rounded-full bg-vein-cyan/5 blur-3xl" />
  ),
});

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
}

interface RecommendedAgent {
  name: LocalizedText;
  description: LocalizedText;
  system_prompt: string;
  tools: { tool_id: string; config: Record<string, unknown> }[];
  installed: boolean;
}

type CellId = "agents" | "flow" | "signal" | "impulses";

// Fokusga qarab to'r trek o'lchamlari — "hujayra o'sadi"
const TEMPLATES: Record<CellId | "none", { cols: string; rows: string }> = {
  none: { cols: "3fr 6fr 3fr", rows: "1.05fr 1fr" },
  agents: { cols: "6.5fr 3.5fr 2fr", rows: "2.3fr 1fr" },
  flow: { cols: "6.5fr 3.5fr 2fr", rows: "1fr 2.3fr" },
  signal: { cols: "2fr 3.5fr 6.5fr", rows: "2.3fr 1fr" },
  impulses: { cols: "2fr 3.5fr 6.5fr", rows: "1fr 2.3fr" },
};

const CELL_POS: Record<CellId | "core", CSSProperties> = {
  agents: { gridColumn: "1", gridRow: "1" },
  flow: { gridColumn: "1", gridRow: "2" },
  core: { gridColumn: "2", gridRow: "1 / span 2" },
  signal: { gridColumn: "3", gridRow: "1" },
  impulses: { gridColumn: "3", gridRow: "2" },
};

function useIsLarge() {
  const [large, setLarge] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setLarge(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return large;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export default function DashboardPage() {
  const api = useApiClient();
  const { t, locale } = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isLg = useIsLarge();
  const idle = useIdle(6000);

  const [focused, setFocused] = useState<CellId | null>(null);
  const [installingIdx, setInstallingIdx] = useState<number | null>(null);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<Me>("/users/me"),
  });
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.get<{ agentCount: number; conversationCount: number }>("/users/me/stats"),
  });
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<any[]>("/agents"),
  });
  const { data: recs } = useQuery({
    queryKey: ["recommendations", me?.domain],
    queryFn: () => api.get<{ recommended_agents: RecommendedAgent[] }>("/users/me/recommendations"),
    enabled: !!me?.onboardingCompleted,
  });

  const agentCount = stats?.agentCount ?? agents?.length ?? 0;
  const convCount = stats?.conversationCount ?? 0;

  // Raqamlar -> tirik holat intensivligi (0..1). Hech qayerda raqam ko'rsatilmaydi.
  const agentsIntensity = clamp01(agentCount / 6);
  const signalIntensity = clamp01(convCount / 25);
  const flowIntensity = clamp01(agentCount / 8 + convCount / 40);

  // Yadro "joni": fokusda kuchli, idle'da chuqur uyquda
  const coreActivity = focused ? 0.6 : idle ? 0.08 : 0.26;

  const quickActions = me?.profileData?.quick_actions ?? [];
  const ghosts = (recs?.recommended_agents ?? []).filter((a) => !a.installed);

  const installGhost = async (agent: RecommendedAgent, idx: number) => {
    setInstallingIdx(idx);
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
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "" });
    } finally {
      setInstallingIdx(null);
    }
  };

  const openImpulse = (prompt: string) => {
    if (agents?.length) {
      router.push(`/agents/${agents[0].id}?q=${encodeURIComponent(prompt)}`);
    } else {
      router.push("/onboarding");
    }
  };

  const toggle = (id: CellId) => setFocused((cur) => (cur === id ? null : id));

  const template = TEMPLATES[focused ?? "none"];

  const CELL_LABELS: Record<CellId, string> = {
    agents: t("neuro.cellAgents"),
    flow: t("neuro.cellFlow"),
    signal: t("neuro.cellSignal"),
    impulses: t("neuro.cellImpulses"),
  };

  // Katak sarlavhasi — mono yorliq + fokusda yopish tugmasi
  const CellHead = ({ id, hint }: { id: CellId; hint: string }) => (
    <div className="flex items-start justify-between">
      <div>
        <p className="label-mono">{CELL_LABELS[id]}</p>
        <AnimatePresence>
          {focused === id && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-1 text-xs text-muted-foreground"
            >
              {hint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      {focused === id && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setFocused(null);
          }}
          aria-label={t("neuro.collapse")}
          className="hit-target text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  const cellClass = (id: CellId) =>
    cn(
      "cursor-pointer p-5 transition-shadow duration-500",
      focused === id ? "shadow-glow" : "hover:shadow-lift",
      idle && !focused && "drift",
    );

  return (
    <>
      <Awakening label={t("neuro.awakening")} />

      {/* Salomlashuv — minimal, shovqinsiz */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-mono">{t("dash.greeting")}</p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl">
            {me?.professionTitle || me?.email?.split("@")[0] || "—"}
          </h1>
        </div>
        <p className="label-mono flex items-center gap-2">
          <span
            className="heartbeat inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: "hsl(var(--vein-cyan))",
              boxShadow: "0 0 10px hsl(var(--vein-cyan) / 0.7)",
            }}
          />
          {t("neuro.listening")}
        </p>
      </div>

      <LayoutGroup>
        <motion.div
          layout
          className="grid grid-cols-2 gap-4 lg:h-[560px]"
          style={
            isLg
              ? { gridTemplateColumns: template.cols, gridTemplateRows: template.rows }
              : undefined
          }
        >
          {/* AGENTLAR — porlovchi shar: yorqinlik = kuch */}
          <LiquidCard
            layout
            vein={focused === "agents"}
            role="button"
            tabIndex={0}
            onClick={() => toggle("agents")}
            onKeyDown={(e) => e.key === "Enter" && toggle("agents")}
            style={isLg ? CELL_POS.agents : undefined}
            className={cn(cellClass("agents"), "min-h-[176px]", focused === "agents" && "col-span-2 lg:col-auto")}
          >
            <div className="flex h-full flex-col">
              <CellHead id="agents" hint={t("neuro.cellAgentsHint")} />
              <div className="relative min-h-0 flex-1">
                <AnimatePresence mode="wait">
                  {focused === "agents" ? (
                    <motion.div
                      key="open"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="scroll-thin absolute inset-0 overflow-y-auto pt-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {agentsLoading ? (
                        <div className="animate-breathe mx-auto mt-8 h-24 w-24 rounded-full bg-vein-cyan/10 blur-2xl" />
                      ) : !agents?.length ? (
                        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                          <p className="max-w-[240px] text-sm text-muted-foreground">{t("neuro.dormant")}</p>
                          <Magnetic>
                            <Link
                              href="/agents/new"
                              className="mercury flex h-10 items-center gap-2 rounded-2xl px-5 text-sm font-semibold"
                            >
                              <Plus className="h-4 w-4" /> {t("neuro.awaken")}
                            </Link>
                          </Magnetic>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2.5">
                          {agents.map((a: any) => (
                            <Link
                              key={a.id}
                              href={`/agents/${a.id}`}
                              className="liquid-glass group flex items-center gap-2.5 rounded-full py-2 pl-3 pr-4 text-sm transition hover:border-white/20"
                            >
                              <span
                                className="heartbeat h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{
                                  background: "hsl(var(--vein-cyan))",
                                  boxShadow: "0 0 8px hsl(var(--vein-cyan) / 0.8)",
                                }}
                              />
                              <span className="max-w-[180px] truncate">{a.name}</span>
                            </Link>
                          ))}
                          {ghosts.map((g, i) => (
                            <button
                              key={`ghost-${i}`}
                              onClick={() => installGhost(g, i)}
                              disabled={installingIdx !== null}
                              title={t("neuro.ghost")}
                              className="flex items-center gap-2.5 rounded-full border border-dashed border-white/15 py-2 pl-3 pr-4 text-sm text-muted-foreground transition hover:border-vein-cyan/40 hover:text-foreground"
                            >
                              {installingIdx === i ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
                              )}
                              <span className="max-w-[180px] truncate">{pick(g.name, locale)}</span>
                            </button>
                          ))}
                          <Link
                            href="/agents/new"
                            aria-label={t("nav.newAgent")}
                            className="liquid-glass flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
                          >
                            <Plus className="h-4 w-4" />
                          </Link>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="closed"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0"
                    >
                      <GlowOrb intensity={agentsIntensity} className="h-full w-full" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </LiquidCard>

          {/* OQIM — daryo: baland suv = katta harakat */}
          <LiquidCard
            layout
            vein={focused === "flow"}
            role="button"
            tabIndex={0}
            onClick={() => toggle("flow")}
            onKeyDown={(e) => e.key === "Enter" && toggle("flow")}
            style={isLg ? CELL_POS.flow : undefined}
            className={cn(cellClass("flow"), "min-h-[176px]", focused === "flow" && "col-span-2 lg:col-auto")}
          >
            <div className="flex h-full flex-col">
              <CellHead id="flow" hint={t("neuro.cellFlowHint")} />
              <div className="relative min-h-0 flex-1">
                <FlowRiver intensity={flowIntensity} className="absolute inset-0" />
                <AnimatePresence>
                  {focused === "flow" && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute bottom-2 left-0 text-xs italic text-muted-foreground"
                    >
                      {t("neuro.flowLine")}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </LiquidCard>

          {/* YADRO — markazdagi jon */}
          <motion.div
            layout
            style={isLg ? CELL_POS.core : undefined}
            className={cn(
              "relative col-span-2 min-h-[280px] lg:col-auto lg:min-h-0",
              idle && !focused && "drift",
            )}
          >
            <NeuroCore
              activity={coreActivity}
              onTap={() => setFocused(null)}
              className="absolute inset-0"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2">
              <p className="label-mono">Neuro-Core</p>
              {me && !me.onboardingCompleted && (
                <Link
                  href="/onboarding"
                  className="vein-text pointer-events-auto text-xs font-medium underline-offset-4 hover:underline"
                >
                  {t("neuro.calibrate")} →
                </Link>
              )}
            </div>
          </motion.div>

          {/* SIGNAL — suhbatlar pulsi */}
          <LiquidCard
            layout
            vein={focused === "signal"}
            role="button"
            tabIndex={0}
            onClick={() => toggle("signal")}
            onKeyDown={(e) => e.key === "Enter" && toggle("signal")}
            style={isLg ? CELL_POS.signal : undefined}
            className={cn(cellClass("signal"), "min-h-[176px]", focused === "signal" && "col-span-2 lg:col-auto")}
          >
            <div className="flex h-full flex-col">
              <CellHead id="signal" hint={t("neuro.cellSignalHint")} />
              <div className="relative min-h-0 flex-1">
                <PulseRings intensity={signalIntensity} className="h-full w-full" />
                <AnimatePresence>
                  {focused === "signal" && !!agents?.length && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-x-0 bottom-1 flex justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Magnetic>
                        <Link
                          href={`/agents/${agents[0].id}`}
                          className="liquid-glass rounded-full px-4 py-2 text-xs font-medium text-foreground/90 transition hover:border-vein-cyan/30"
                        >
                          {t("neuro.lastSignal")} →
                        </Link>
                      </Magnetic>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </LiquidCard>

          {/* IMPULSLAR — bir teginishda buyruq */}
          <LiquidCard
            layout
            vein={focused === "impulses"}
            role="button"
            tabIndex={0}
            onClick={() => toggle("impulses")}
            onKeyDown={(e) => e.key === "Enter" && toggle("impulses")}
            style={isLg ? CELL_POS.impulses : undefined}
            className={cn(cellClass("impulses"), "min-h-[176px]", focused === "impulses" && "col-span-2 lg:col-auto")}
          >
            <div className="flex h-full flex-col">
              <CellHead id="impulses" hint={t("neuro.cellImpulsesHint")} />
              <div
                className="scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto"
                onClick={(e) => focused === "impulses" && e.stopPropagation()}
              >
                {quickActions.length === 0 ? (
                  <Link
                    href="/onboarding"
                    onClick={(e) => e.stopPropagation()}
                    className="vein-text text-xs font-medium underline-offset-4 hover:underline"
                  >
                    {t("neuro.calibrate")} →
                  </Link>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(focused === "impulses" ? quickActions : quickActions.slice(0, 2)).map((qa, i) => {
                      const label = pick(qa, locale);
                      return (
                        <button
                          key={i}
                          onClick={(e) => {
                            e.stopPropagation();
                            openImpulse(label);
                          }}
                          className="liquid-glass max-w-full truncate rounded-full px-4 py-2 text-left text-xs font-medium text-foreground/85 transition hover:border-vein-cyan/30 hover:text-foreground"
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </LiquidCard>
        </motion.div>
      </LayoutGroup>
    </>
  );
}
