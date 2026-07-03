"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Stethoscope, Flame, Wallet, CalendarDays,
  Send, DollarSign, CloudSun, Check, ShieldCheck, Globe,
} from "lucide-react";

const MODELS = [
  { value: "claude-sonnet-4-6", key: "form.modelRecommended", label: "Claude Sonnet 4.6" },
  { value: "claude-haiku-4-5", key: "form.modelFast", label: "Claude Haiku 4.5" },
  { value: "claude-opus-4-8", key: "form.modelPowerful", label: "Claude Opus 4.8" },
];

// Universal, kasbiy vositalar (diniy vositalar yadro namoyishidan olib tashlandi)
const TOOLS = [
  { id: "knowledge.search", icon: Globe, key: "tool.knowledge", dkey: "tool.knowledgeDesc" },
  { id: "finance.get_transactions", icon: Wallet, key: "tool.transactions", dkey: "tool.transactionsDesc" },
  { id: "finance.currency_rates", icon: DollarSign, key: "tool.currency", dkey: "tool.currencyDesc" },
  { id: "calendar.get_events", icon: CalendarDays, key: "tool.calendar", dkey: "tool.calendarDesc" },
  { id: "messaging.telegram_send", icon: Send, key: "tool.telegram", dkey: "tool.telegramDesc" },
  { id: "utility.weather", icon: CloudSun, key: "tool.weather", dkey: "tool.weatherDesc" },
  { id: "health.symptom_check", icon: Stethoscope, key: "tool.symptom", dkey: "tool.symptomDesc" },
  { id: "health.calorie_estimate", icon: Flame, key: "tool.calorie", dkey: "tool.calorieDesc" },
];

interface AgentFormProps {
  defaultValues?: any;
  onSubmit: (data: any) => Promise<any>;
  isLoading?: boolean;
  error?: string;
  submitLabel?: string;
  /** Jonli 3D ko'rinish uchun — tanlangan vositalar o'zgarganda chaqiriladi */
  onToolsChange?: (tools: string[]) => void;
}

export function AgentForm({ defaultValues, onSubmit, isLoading, error, submitLabel, onToolsChange }: AgentFormProps) {
  const { t } = useT();
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [systemPrompt, setSystemPrompt] = useState(defaultValues?.systemPrompt ?? "");
  const [model, setModel] = useState(defaultValues?.model ?? "claude-sonnet-4-6");
  const [memoryEnabled, setMemoryEnabled] = useState(defaultValues?.memoryEnabled ?? true);
  const [selectedTools, setSelectedTools] = useState<string[]>(
    (defaultValues?.toolsConfig as any[])?.map((t: any) => t.tool_id) ?? [],
  );

  const toggleTool = (id: string) =>
    setSelectedTools((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      onToolsChange?.(next);
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      name,
      systemPrompt,
      model,
      memoryEnabled,
      halalFilterEnabled: true,
      toolsConfig: selectedTools.map((tool_id) => ({ tool_id, config: {} })),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border bg-card p-6 shadow-soft">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="agent-name" className="text-sm font-medium">{t("form.name")} *</label>
        <Input
          id="agent-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("form.namePlaceholder")}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="agent-prompt" className="text-sm font-medium">{t("form.systemPrompt")} *</label>
        <p className="text-xs text-muted-foreground">{t("form.systemPromptHint")}</p>
        <Textarea
          id="agent-prompt"
          required
          rows={5}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder={t("form.systemPromptPlaceholder")}
          className="resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">{t("form.model")}</label>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODELS.map((m) => (
            <button
              type="button"
              key={m.value}
              onClick={() => setModel(m.value)}
              aria-pressed={model === m.value}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                model === m.value ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:bg-muted",
              )}
            >
              <p className="text-sm font-medium">{m.label}</p>
              <p className="text-xs text-muted-foreground">{t(m.key)}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">{t("form.tools")}</label>
          <p className="text-xs text-muted-foreground">{t("form.toolsHint")}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {TOOLS.map((tool) => {
            const checked = selectedTools.includes(tool.id);
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => toggleTool(tool.id)}
                aria-pressed={checked}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-left transition",
                  checked ? "border-primary bg-primary/5" : "hover:bg-muted",
                )}
              >
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t(tool.key)}</p>
                  <p className="truncate text-xs text-muted-foreground">{t(tool.dkey)}</p>
                </div>
                {checked && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border p-4">
        <div>
          <p className="text-sm font-medium">{t("form.memory")}</p>
          <p className="text-xs text-muted-foreground">{t("form.memoryHint")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={memoryEnabled}
          aria-label={t("form.memory")}
          onClick={() => setMemoryEnabled(!memoryEnabled)}
          className={cn("relative h-6 w-11 rounded-full transition-colors", memoryEnabled ? "bg-primary" : "bg-input")}
        >
          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", memoryEnabled ? "translate-x-5" : "translate-x-0.5")} />
        </button>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-primary">{t("form.halal")}</p>
            <p className="text-xs text-primary/70">{t("form.halalHint")}</p>
          </div>
        </div>
        <div className="flex h-6 w-11 items-center justify-end rounded-full bg-primary pr-0.5">
          <span className="h-5 w-5 rounded-full bg-white shadow" />
        </div>
      </div>

      <Button type="submit" size="lg" disabled={isLoading || !name || !systemPrompt} className="w-full">
        {isLoading ? t("form.saving") : submitLabel || t("form.submit")}
      </Button>
    </form>
  );
}
