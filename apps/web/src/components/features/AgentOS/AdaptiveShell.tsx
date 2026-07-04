"use client";
import { motion, AnimatePresence } from "framer-motion";
import type { UserRole } from "./store/agentStore";
import { useAgentStore } from "./store/agentStore";
import {
  ActivityWidget, DiagnosticsWidget, GlobeWidget, JobQueueWidget,
  PatientQueueWidget, ProtocolWidget, SecureCommWidget, TickerWidget,
  TorqueButtonsWidget, VitalsWidget, WelcomeWidget,
} from "./widgets";

/**
 * AdaptiveShell — generativ layout dvigateli.
 * Layout QATTIQ KODLANMAGAN: RoleLayoutMap lug'ati rol → vidjet-spec ro'yxati
 * beradi; bento-grid prioritet va o'lchamga qarab avtomatik teradi.
 * Rol almashganda framer-motion spring bilan morflanadi.
 */

type WidgetSize = "sm" | "md" | "lg" | "xl";

interface WidgetSpec {
  id: string;
  size: WidgetSize;
  /** Kichik raqam = yuqoriroq prioritet (avval teriladi) */
  priority: number;
  Component: React.ComponentType;
}

const RoleLayoutMap: Record<UserRole, WidgetSpec[]> = {
  generic: [
    { id: "welcome", size: "lg", priority: 1, Component: WelcomeWidget },
    { id: "activity", size: "md", priority: 2, Component: ActivityWidget },
  ],
  doctor: [
    { id: "vitals", size: "lg", priority: 1, Component: VitalsWidget },
    { id: "queue", size: "md", priority: 2, Component: PatientQueueWidget },
    { id: "protocol", size: "md", priority: 3, Component: ProtocolWidget },
    { id: "activity", size: "sm", priority: 4, Component: ActivityWidget },
  ],
  mechanic: [
    { id: "diag", size: "lg", priority: 1, Component: DiagnosticsWidget },
    { id: "torque", size: "md", priority: 2, Component: TorqueButtonsWidget },
    { id: "jobs", size: "md", priority: 3, Component: JobQueueWidget },
  ],
  president: [
    { id: "globe", size: "lg", priority: 1, Component: GlobeWidget },
    { id: "tickers", size: "md", priority: 2, Component: TickerWidget },
    { id: "comm", size: "md", priority: 3, Component: SecureCommWidget },
    { id: "activity", size: "sm", priority: 4, Component: ActivityWidget },
  ],
};

const SIZE_CLASS: Record<WidgetSize, string> = {
  sm: "col-span-2 row-span-1",
  md: "col-span-3 row-span-1",
  lg: "col-span-4 row-span-2",
  xl: "col-span-6 row-span-2",
};

export function AdaptiveShell({ className }: { className?: string }) {
  const role = useAgentStore((s) => s.role);
  const widgets = [...RoleLayoutMap[role]].sort((a, b) => a.priority - b.priority);

  return (
    <div className={className}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={role}
          className="grid auto-rows-[minmax(120px,1fr)] grid-cols-6 gap-3"
          initial="hidden"
          animate="show"
          exit="exit"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.07 } },
            exit: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
          }}
        >
          {widgets.map(({ id, size, Component }) => (
            <motion.div
              key={`${role}-${id}`}
              layout
              className={SIZE_CLASS[size]}
              variants={{
                hidden: { opacity: 0, scale: 0.92, y: 18 },
                show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 28 } },
                exit: { opacity: 0, scale: 0.94, y: -10, transition: { type: "spring", stiffness: 380, damping: 32 } },
              }}
            >
              <Component />
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
