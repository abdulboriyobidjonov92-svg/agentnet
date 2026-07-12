"use client";
import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useT } from "@/lib/i18n/client";
import { FlowRiver } from "@/components/neuro/living";
import { DashboardCell } from "./dashboard-cell";

// OQIM — daryo: baland suv = katta harakat
export function FlowCell({
  active,
  idle,
  style,
  onToggle,
  intensity,
}: {
  active: boolean;
  idle: boolean;
  style?: CSSProperties;
  onToggle: () => void;
  intensity: number;
}) {
  const { t } = useT();

  return (
    <DashboardCell
      label={t("neuro.cellFlow")}
      hint={t("neuro.cellFlowHint")}
      active={active}
      idle={idle}
      style={style}
      onToggle={onToggle}
      closeLabel={t("neuro.collapse")}
    >
      <div className="relative min-h-0 flex-1">
        <FlowRiver intensity={intensity} className="absolute inset-0" />
        <AnimatePresence>
          {active && (
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
    </DashboardCell>
  );
}
