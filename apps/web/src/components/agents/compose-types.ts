export interface TemplateMatch {
  id: string;
  profession: string;
  flagship: string;
  matchPercent: number;
  price: { createSom: number; monthlySom: number };
}

export interface ComposeProposal {
  name: string;
  systemPrompt: string;
  model: string;
  toolsConfig: { tool_id: string; config: Record<string, unknown> }[];
  vertical?: string;
  description?: string;
  halalFilterEnabled: boolean;
  memoryEnabled: boolean;
}

export interface ComposeResult {
  proposal: ComposeProposal;
  meta: {
    domain: string;
    vertical: string | null;
    complexity: number;
    reasoning: string;
    method: "llm" | "heuristic";
    matched: string | null;
    toolIds: string[];
    language: string;
  };
  price: {
    complexity: number;
    toolCount: number;
    creationUsd: number;
    monthlyUsd: number;
    creationSom: number;
    monthlySom: number;
    fxRate: number;
  };
}
