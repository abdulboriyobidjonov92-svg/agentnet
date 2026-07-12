export type LocalizedText = Record<string, string>;

export function pick(text: LocalizedText | undefined, locale: string): string {
  if (!text) return "";
  return text[locale] ?? text.en ?? Object.values(text)[0] ?? "";
}

export interface RecommendedAgent {
  name: LocalizedText;
  description: LocalizedText;
  system_prompt: string;
  tools: { tool_id: string; config: Record<string, unknown> }[];
}

export interface DetectedProfile {
  profession_title: string;
  domain: string;
  domain_label: LocalizedText;
  confidence: number;
  reasoning: string;
  goals: string[];
  method: string;
  recommended_agents: RecommendedAgent[];
  dashboard: { widgets: string[]; quick_actions: LocalizedText[] };
}
