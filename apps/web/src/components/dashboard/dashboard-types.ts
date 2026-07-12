import type { CSSProperties } from "react";

export type LocalizedText = Record<string, string>;

export function pick(text: LocalizedText | undefined, locale: string): string {
  if (!text) return "";
  return text[locale] ?? text.en ?? Object.values(text)[0] ?? "";
}

export interface Me {
  id: string;
  email: string;
  name?: string | null;
  professionTitle?: string | null;
  domain?: string | null;
  onboardingCompleted: boolean;
  profileData?: {
    domain_label?: LocalizedText;
    quick_actions?: LocalizedText[];
    widgets?: string[];
  } | null;
}

export interface RecommendedAgent {
  name: LocalizedText;
  description: LocalizedText;
  system_prompt: string;
  tools: { tool_id: string; config: Record<string, unknown> }[];
  installed: boolean;
}

export type CellId = "agents" | "flow" | "signal" | "impulses";

// Fokusga qarab to'r trek o'lchamlari — "hujayra o'sadi"
export const TEMPLATES: Record<CellId | "none", { cols: string; rows: string }> = {
  none: { cols: "3fr 6fr 3fr", rows: "1.05fr 1fr" },
  agents: { cols: "6.5fr 3.5fr 2fr", rows: "2.3fr 1fr" },
  flow: { cols: "6.5fr 3.5fr 2fr", rows: "1fr 2.3fr" },
  signal: { cols: "2fr 3.5fr 6.5fr", rows: "2.3fr 1fr" },
  impulses: { cols: "2fr 3.5fr 6.5fr", rows: "1fr 2.3fr" },
};

export const CELL_POS: Record<CellId | "core", CSSProperties> = {
  agents: { gridColumn: "1", gridRow: "1" },
  flow: { gridColumn: "1", gridRow: "2" },
  core: { gridColumn: "2", gridRow: "1 / span 2" },
  signal: { gridColumn: "3", gridRow: "1" },
  impulses: { gridColumn: "3", gridRow: "2" },
};

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
