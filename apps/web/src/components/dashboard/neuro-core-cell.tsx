"use client";
import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { Me } from "./dashboard-types";

// Yadro — faqat klientda; yuklanayotganda nafas oluvchi nur qoladi
const NeuroCore = dynamic(() => import("@/components/neuro/neuro-core"), {
  ssr: false,
  loading: () => (
    <div className="animate-breathe m-auto h-1/2 w-1/2 rounded-full bg-vein-cyan/5 blur-3xl" />
  ),
});

// YADRO — markazdagi jon
export function NeuroCoreCell({
  style,
  idle,
  focused,
  activity,
  onTap,
  me,
}: {
  style?: CSSProperties;
  idle: boolean;
  focused: boolean;
  activity: number;
  onTap: () => void;
  me: Me | undefined;
}) {
  const { t } = useT();

  return (
    <motion.div
      layout
      style={style}
      className={cn(
        "relative col-span-2 min-h-[280px] lg:col-auto lg:min-h-0",
        idle && !focused && "drift",
      )}
    >
      <NeuroCore activity={activity} onTap={onTap} className="absolute inset-0" />
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
  );
}
