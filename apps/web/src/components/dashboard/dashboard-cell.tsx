"use client";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LiquidCard } from "@/components/neuro/liquid-card";
import { CellHead } from "./cell-head";

/** Bitta bento katagi: LiquidCard qobig'i + umumiy sarlavha/fokus/idle xatti-harakati. */
export function DashboardCell({
  label,
  hint,
  active,
  idle,
  style,
  onToggle,
  closeLabel,
  children,
}: {
  label: string;
  hint: string;
  active: boolean;
  idle: boolean;
  style?: CSSProperties;
  onToggle: () => void;
  closeLabel: string;
  children: ReactNode;
}) {
  return (
    <LiquidCard
      layout
      vein={active}
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => e.key === "Enter" && onToggle()}
      style={style}
      className={cn(
        "cursor-pointer p-5 transition-shadow duration-500",
        active ? "shadow-glow" : "hover:shadow-lift",
        idle && !active && "drift",
        "min-h-[176px]",
        active && "col-span-2 lg:col-auto",
      )}
    >
      <div className="flex h-full flex-col">
        <CellHead label={label} hint={hint} active={active} onClose={onToggle} closeLabel={closeLabel} />
        {children}
      </div>
    </LiquidCard>
  );
}
