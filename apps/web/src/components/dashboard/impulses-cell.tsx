"use client";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { DashboardCell } from "./dashboard-cell";
import { pick, type LocalizedText } from "./dashboard-types";

// IMPULSLAR — bir teginishda buyruq
export function ImpulsesCell({
  active,
  idle,
  style,
  onToggle,
  quickActions,
  onImpulse,
  locale,
}: {
  active: boolean;
  idle: boolean;
  style?: CSSProperties;
  onToggle: () => void;
  quickActions: LocalizedText[];
  onImpulse: (prompt: string) => void;
  locale: string;
}) {
  const { t } = useT();

  return (
    <DashboardCell
      label={t("neuro.cellImpulses")}
      hint={t("neuro.cellImpulsesHint")}
      active={active}
      idle={idle}
      style={style}
      onToggle={onToggle}
      closeLabel={t("neuro.collapse")}
    >
      <div
        className="scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto"
        onClick={(e) => active && e.stopPropagation()}
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
            {(active ? quickActions : quickActions.slice(0, 2)).map((qa, i) => {
              const label = pick(qa, locale);
              return (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    onImpulse(label);
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
    </DashboardCell>
  );
}
