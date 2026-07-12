/**
 * Shablon katalogi (20 ta, har biri o'z faylida) catalog/ papkasida —
 * bu yerda faqat katalogdan hosila mantiq: registry lookup, tool
 * yig'ish va system-prompt qurish.
 */
import { AgentTemplate, loc } from './types';
import { getModules } from './modules';
import { TEMPLATES } from './catalog';

export const TEMPLATE_REGISTRY: Record<string, AgentTemplate> = Object.fromEntries(
  TEMPLATES.map((t) => [t.id, t]),
);

export function allTemplates(): AgentTemplate[] {
  return TEMPLATES;
}

/** Modul tool'larini birlashtiradi (takrorsiz) — ToolSpec ro'yxati. */
export function assembleTools(t: AgentTemplate): { tool_id: string; config: Record<string, unknown> }[] {
  const ids = new Set<string>();
  for (const m of getModules(t.moduleIds)) for (const tool of m.tools) ids.add(tool);
  return [...ids].map((tool_id) => ({ tool_id, config: {} }));
}

const VERTICAL_DISCLAIMER: Record<string, string> = {
  healthcare: 'This is decision support and drafting help, never a diagnosis or licensed medical advice.',
  legal: 'This is drafting and analysis support, not licensed legal advice.',
  finance: 'This is information and bookkeeping support, not licensed financial advice.',
};

/** Modullardan agent system-promptini yig'adi (predict + act tamoyili bilan). */
export function buildSystemPrompt(t: AgentTemplate, language: string): string {
  const prof = loc(t.profession, language);
  const modules = getModules(t.moduleIds);
  const capabilities = modules.map((m) => `- ${m.promptFragment}`).join('\n');
  const disclaimer = t.vertical ? VERTICAL_DISCLAIMER[t.vertical] : undefined;

  return [
    `You are an AI assistant for a ${prof} — a small business owner in Uzbekistan.`,
    `You do not merely send reminders: you ANALYZE the owner's real data, PREDICT what happens next, and take autonomous action where it is safe.`,
    ``,
    `Capabilities:`,
    capabilities,
    ``,
    `Principles: ground every prediction in the owner's actual numbers and state it is an estimate with its assumptions; for autonomous actions, draft and send for the owner's approval rather than doing irreversible things silently.`,
    disclaimer ? disclaimer : '',
    `Always reply in the language the user writes in.`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Shablonda kamida bitta bashorat va bitta avtonom modul bormi (brief talabi). */
export function templateDepth(t: AgentTemplate): { prediction: boolean; autonomous: boolean } {
  const modules = getModules(t.moduleIds);
  return {
    prediction: modules.some((m) => m.prediction),
    autonomous: modules.some((m) => m.autonomous),
  };
}
