"use client";
import type { CSSProperties } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useT } from "@/lib/i18n/client";
import { Magnetic } from "@/components/neuro/magnetic";
import { PulseRings } from "@/components/neuro/living";
import { DashboardCell } from "./dashboard-cell";

// SIGNAL — suhbatlar pulsi
export function SignalCell({
  active,
  idle,
  style,
  onToggle,
  intensity,
  firstAgentId,
}: {
  active: boolean;
  idle: boolean;
  style?: CSSProperties;
  onToggle: () => void;
  intensity: number;
  firstAgentId: string | undefined;
}) {
  const { t } = useT();

  return (
    <DashboardCell
      label={t("neuro.cellSignal")}
      hint={t("neuro.cellSignalHint")}
      active={active}
      idle={idle}
      style={style}
      onToggle={onToggle}
      closeLabel={t("neuro.collapse")}
    >
      <div className="relative min-h-0 flex-1">
        <PulseRings intensity={intensity} className="h-full w-full" />
        <AnimatePresence>
          {active && !!firstAgentId && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-0 bottom-1 flex justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Magnetic>
                <Link
                  href={`/agents/${firstAgentId}`}
                  className="liquid-glass rounded-full px-4 py-2 text-xs font-medium text-foreground/90 transition hover:border-vein-cyan/30"
                >
                  {t("neuro.lastSignal")} →
                </Link>
              </Magnetic>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardCell>
  );
}
