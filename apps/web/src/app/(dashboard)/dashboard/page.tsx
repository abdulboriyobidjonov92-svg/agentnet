"use client";
// BOSHQARUV — "The Morph": moslashuvchan bento to'ri.
// Raqamlar yo'q: agentlar — porlovchi shar, suhbatlar — puls, harakat — daryo.
// Katak fokus olsa, tirik hujayra kabi o'sadi va qolganlarini surib qo'yadi
// (grid trek o'lchamlari o'zgaradi, framer-motion layout FLIP silliqlaydi).
// Foydalanuvchi to'xtasa — interfeys "nafas oladi" (drift).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGroup, motion } from "framer-motion";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { toast } from "@/components/ui/toast";
import { Awakening } from "@/components/neuro/awakening";
import { useIdle } from "@/components/neuro/use-idle";
import { useIsLarge } from "@/components/dashboard/use-is-large";
import { AgentsCell } from "@/components/dashboard/agents-cell";
import { FlowCell } from "@/components/dashboard/flow-cell";
import { NeuroCoreCell } from "@/components/dashboard/neuro-core-cell";
import { SignalCell } from "@/components/dashboard/signal-cell";
import { ImpulsesCell } from "@/components/dashboard/impulses-cell";
import {
  clamp01,
  pick,
  TEMPLATES,
  CELL_POS,
  type CellId,
  type Me,
  type RecommendedAgent,
} from "@/components/dashboard/dashboard-types";

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

  return (
    <>
      <Awakening label={t("neuro.awakening")} />

      {/* Salomlashuv — minimal, shovqinsiz */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-mono">{t("dash.greeting")}</p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl">
            {me?.name || me?.professionTitle || me?.email?.split("@")[0] || "—"}
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
          <AgentsCell
            active={focused === "agents"}
            idle={idle}
            style={isLg ? CELL_POS.agents : undefined}
            onToggle={() => toggle("agents")}
            intensity={agentsIntensity}
            agentsLoading={agentsLoading}
            agents={agents}
            ghosts={ghosts}
            installingIdx={installingIdx}
            onInstall={installGhost}
            locale={locale}
          />

          <FlowCell
            active={focused === "flow"}
            idle={idle}
            style={isLg ? CELL_POS.flow : undefined}
            onToggle={() => toggle("flow")}
            intensity={flowIntensity}
          />

          <NeuroCoreCell
            style={isLg ? CELL_POS.core : undefined}
            idle={idle}
            focused={!!focused}
            activity={coreActivity}
            onTap={() => setFocused(null)}
            me={me}
          />

          <SignalCell
            active={focused === "signal"}
            idle={idle}
            style={isLg ? CELL_POS.signal : undefined}
            onToggle={() => toggle("signal")}
            intensity={signalIntensity}
            firstAgentId={agents?.[0]?.id}
          />

          <ImpulsesCell
            active={focused === "impulses"}
            idle={idle}
            style={isLg ? CELL_POS.impulses : undefined}
            onToggle={() => toggle("impulses")}
            quickActions={quickActions}
            onImpulse={openImpulse}
            locale={locale}
          />
        </motion.div>
      </LayoutGroup>
    </>
  );
}
