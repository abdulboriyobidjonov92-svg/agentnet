"use client";
import type { CSSProperties } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Plus } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Magnetic } from "@/components/neuro/magnetic";
import { GlowOrb } from "@/components/neuro/living";
import { DashboardCell } from "./dashboard-cell";
import { pick, type RecommendedAgent } from "./dashboard-types";

// AGENTLAR — porlovchi shar: yorqinlik = kuch
export function AgentsCell({
  active,
  idle,
  style,
  onToggle,
  intensity,
  agentsLoading,
  agents,
  ghosts,
  installingIdx,
  onInstall,
  locale,
}: {
  active: boolean;
  idle: boolean;
  style?: CSSProperties;
  onToggle: () => void;
  intensity: number;
  agentsLoading: boolean;
  agents: any[] | undefined;
  ghosts: RecommendedAgent[];
  installingIdx: number | null;
  onInstall: (agent: RecommendedAgent, idx: number) => void;
  locale: string;
}) {
  const { t } = useT();

  return (
    <DashboardCell
      label={t("neuro.cellAgents")}
      hint={t("neuro.cellAgentsHint")}
      active={active}
      idle={idle}
      style={style}
      onToggle={onToggle}
      closeLabel={t("neuro.collapse")}
    >
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          {active ? (
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
                      onClick={() => onInstall(g, i)}
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
              <GlowOrb intensity={intensity} className="h-full w-full" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardCell>
  );
}
