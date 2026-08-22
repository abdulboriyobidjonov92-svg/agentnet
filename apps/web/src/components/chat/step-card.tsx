"use client";

import { Wrench, ShieldCheck, RotateCw, CheckCircle2, XCircle, Cpu } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { StatusDot, type RunState } from "@/components/ui/status";

/**
 * UI-4 — ijro qadamining ko'rinishi.
 *
 * ⚠️ FRONTEND MANTIQI YO'Q. Bu komponent kanonik hodisa TURINI ko'rinishga
 * o'giradi, xolos (blueprint §2.3). "Qaysi qadam nima qildi" qarori
 * backendda (`execution-trace-tap.ts`) — bu yerda takrorlanmaydi, aks holda
 * ikkita haqiqat manbai paydo bo'lardi.
 */

/** Kanonik hodisa turlari (Prisma enum bilan bir xil, web'da mustaqil nusxa). */
export type ExecutionEventType =
  | "RUN_STARTED"
  | "MODEL_STARTED"
  | "MODEL_COMPLETED"
  | "TOOL_SELECTED"
  | "POLICY_CHECK"
  | "APPROVAL_REQUIRED"
  | "APPROVAL_GRANTED"
  | "APPROVAL_DENIED"
  | "TOOL_STARTED"
  | "TOOL_RESULT"
  | "TOOL_FAILED"
  | "RETRY_STARTED"
  | "CHECKPOINT_SAVED"
  | "RUN_COMPLETED"
  | "RUN_FAILED"
  | "RUN_CANCELLED";

export interface ExecutionEvent {
  id: string;
  seq: number;
  stepId: string | null;
  type: ExecutionEventType;
  actor: string;
  payload?: unknown;
  latencyMs: number | null;
  createdAt: string;
}

/**
 * Chat oqimida KO'RSATILADIGAN hodisalar.
 *
 * `RUN_STARTED`/`MODEL_*` ataylab yo'q: foydalanuvchi uchun "model boshlandi"
 * yangilik emas — u javob yozilayotganini allaqachon ko'rib turadi. Trace
 * sahifasida esa HAMMASI ko'rinadi (u yerda savol boshqa: "aynan nima bo'ldi?").
 */
const CHAT_VISIBLE: ReadonlySet<ExecutionEventType> = new Set([
  "TOOL_SELECTED",
  "TOOL_STARTED",
  "TOOL_RESULT",
  "TOOL_FAILED",
  "POLICY_CHECK",
  "APPROVAL_REQUIRED",
  "APPROVAL_GRANTED",
  "APPROVAL_DENIED",
  "RETRY_STARTED",
]);

export function isChatVisible(type: ExecutionEventType): boolean {
  return CHAT_VISIBLE.has(type);
}

const ICONS: Partial<Record<ExecutionEventType, typeof Wrench>> = {
  TOOL_SELECTED: Wrench,
  TOOL_STARTED: Wrench,
  TOOL_RESULT: CheckCircle2,
  TOOL_FAILED: XCircle,
  POLICY_CHECK: ShieldCheck,
  APPROVAL_REQUIRED: ShieldCheck,
  APPROVAL_GRANTED: CheckCircle2,
  APPROVAL_DENIED: XCircle,
  RETRY_STARTED: RotateCw,
  MODEL_STARTED: Cpu,
  MODEL_COMPLETED: Cpu,
};

/** Hodisa turi → holat rangi (UI-1 tokenlari). */
const STATE: Partial<Record<ExecutionEventType, RunState>> = {
  TOOL_SELECTED: "running",
  TOOL_STARTED: "running",
  TOOL_RESULT: "success",
  TOOL_FAILED: "failed",
  POLICY_CHECK: "blocked",
  APPROVAL_REQUIRED: "waiting",
  APPROVAL_GRANTED: "success",
  APPROVAL_DENIED: "blocked",
  RETRY_STARTED: "running",
  RUN_COMPLETED: "success",
  RUN_FAILED: "failed",
  RUN_CANCELLED: "cancelled",
};

/** Payloaddan tool nomini ajratadi (backend shakli: `{tool, calling}`). */
function toolName(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  return typeof p.tool === "string" ? p.tool : null;
}

function reasonText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  for (const key of ["reason", "message"]) {
    if (typeof p[key] === "string" && p[key]) return p[key] as string;
  }
  return null;
}

export function StepCard({ event, compact }: { event: ExecutionEvent; compact?: boolean }) {
  const { t } = useT();
  const Icon = ICONS[event.type] ?? Wrench;
  const state = STATE[event.type] ?? "running";
  const tool = toolName(event.payload);
  const reason = reasonText(event.payload);

  // Sarlavha: tool nomi bo'lsa u bilan, aks holda hodisa turining tarjimasi.
  const title = tool
    ? `${t(`step.${event.type}`)} — ${tool}`
    : t(`step.${event.type}`);

  return (
    <div
      data-state-kind={state}
      data-event-type={event.type}
      className="state-surface flex items-start gap-2.5 rounded-xl px-3 py-2 text-xs"
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {reason && <span className="mt-0.5 block opacity-80">{reason}</span>}
      </span>
      {!compact && event.latencyMs != null && (
        <span className="nums shrink-0 opacity-70">{event.latencyMs}ms</span>
      )}
      <StatusDot state={state} className="mt-1" />
    </div>
  );
}
