"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient, unwrapPage } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Plug, CheckCircle2, KeyRound, FileWarning, X, Loader2, Unplug, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { RiskBadge } from "@/components/ui/status";
import { connectorRiskTier } from "@/lib/connector-risk";

/** S2: Connector SDK UI — katalog, ulanish, holat, agentga biriktirish (UI-3). */
export default function ConnectorsPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const { t } = useT();
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saveResult, setSaveResult] = useState<string | null>(null);
  /** "" = barcha agentlar (umumiy yozuv); aks holda aniq agent id. */
  const [targetAgentId, setTargetAgentId] = useState("");

  const { data: connectors, isError, refetch } = useQuery({
    queryKey: ["connectors"],
    queryFn: () => api.get<any[]>("/connectors/mine"),
  });

  // Biriktirish uchun agentlar ro'yxati. Faqat panel ochilganda kerak,
  // lekin ro'yxat kichik (Free 5, Pro 100) — oldindan olish kechikishni
  // yo'q qiladi va panel darhol to'liq ochiladi.
  const { data: agents } = useQuery({
    queryKey: ["agents", "for-connectors"],
    queryFn: async () => unwrapPage(await api.get<any>("/agents?limit=100")),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      api.post<any>(`/connectors/${selected.id}/configure`, {
        config: form,
        // Bo'sh satr YUBORILMAYDI — backend `agentId` yo'qligini "umumiy"
        // deb tushunadi (`agentId: null`).
        ...(targetAgentId ? { agentId: targetAgentId } : {}),
      }),
    onSuccess: (res) => {
      setSaveResult(res.status === "connected" ? "connected" : `needs: ${res.missing?.join(", ")}`);
      qc.invalidateQueries({ queryKey: ["connectors"] });
    },
    onError: (e: any) => setSaveResult(e.message),
  });

  /** Uzish — qamrov aniq: umumiy yoki aynan bitta agent (backend `?agentId=`). */
  const detachMutation = useMutation({
    mutationFn: ({ connectorId, agentId }: { connectorId: string; agentId?: string }) =>
      api.delete(`/connectors/${connectorId}/configure${agentId ? `?agentId=${agentId}` : ""}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connectors"] }),
  });

  const categories = [...new Set((connectors ?? []).map((c) => c.category))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("conn.title")}</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">{t("conn.subtitle")}</p>
      </div>

      {isError && <ErrorState onRetry={() => refetch()} />}

      {categories.map((cat) => (
        <div key={cat}>
          <h2 className="mb-3 font-semibold capitalize">{cat}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(connectors ?? [])
              .filter((c) => c.category === cat)
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelected(c); setForm({}); setSaveResult(null); setTargetAgentId(""); }}
                  className="flex flex-col rounded-2xl border bg-card p-5 text-left shadow-soft transition hover:shadow-lift"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Plug className="h-5 w-5" />
                    </div>
                    <StatusBadge c={c} t={t} />
                  </div>
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">{c.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {/* Risk tier — foydalanuvchi biriktirishdan OLDIN ko'radi. */}
                    <RiskBadge tier={connectorRiskTier(c)} label={t(`risk.${connectorRiskTier(c)}`)} />
                    {c.region && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{c.region}</span>}
                    {c.actions?.slice(0, 2).map((a: any) => (
                      <span key={a.id} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{a.id}</span>
                    ))}
                  </div>

                  {/* Kim ishlatadi — UI-3 ning markaziy savoli. */}
                  <div className="mt-3 border-t pt-3 text-xs">
                    {c.connected && (
                      <p className="flex items-center gap-1.5 text-muted-foreground">
                        <Bot className="h-3 w-3 shrink-0" /> {t("conn.allAgents")}
                      </p>
                    )}
                    {c.attachedAgents?.length > 0 && (
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-muted-foreground">
                        <Bot className="h-3 w-3 shrink-0" />
                        {c.attachedAgents.map((a: any) => (
                          <span key={a.id} className="rounded-full bg-secondary px-2 py-0.5">{a.name}</span>
                        ))}
                      </p>
                    )}
                    {!c.connected && !c.attachedAgents?.length && (
                      <p className="text-muted-foreground">{t("conn.noAgents")}</p>
                    )}
                  </div>
                </button>
              ))}
          </div>
        </div>
      ))}

      {/* Konfiguratsiya paneli */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl border bg-card p-6 shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">{selected.name}</h3>
                <p className="text-sm text-muted-foreground">{selected.description}</p>
              </div>
              <button onClick={() => setSelected(null)} aria-label={t("common.cancel")} className="-m-2 rounded-lg p-3.5 text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            {selected.availability === "agreement_required" && (
              <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <FileWarning className="mb-1 h-4 w-4 text-amber-500" />
                {t("conn.agreement")} — action-sxema tayyor; rasmiy kelishuv imzolangach jonli ishlaydi.
              </div>
            )}

            {/* --- UI-3: qaysi agent ishlatadi --- */}
            <div className="mb-4 rounded-xl border p-3">
              <label htmlFor="conn-agent" className="mb-1.5 block text-sm font-medium">
                {t("conn.whichAgent")}
              </label>
              <select
                id="conn-agent"
                value={targetAgentId}
                onChange={(e) => setTargetAgentId(e.target.value)}
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none transition"
              >
                <option value="">{t("conn.allAgents")}</option>
                {(agents ?? []).map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {targetAgentId ? t("conn.scopeAgentHint") : t("conn.scopeAllHint")}
              </p>
            </div>

            {/* Mavjud biriktirmalar — uzish shu yerdan */}
            {(selected.connected || selected.attachedAgents?.length > 0) && (
              <div className="mb-4 space-y-1.5">
                <p className="text-sm font-medium">{t("conn.attached")}</p>
                {selected.connected && (
                  <AttachedRow
                    name={t("conn.allAgents")}
                    onDetach={() => detachMutation.mutate({ connectorId: selected.id })}
                    pending={detachMutation.isPending}
                    label={t("conn.detach")}
                  />
                )}
                {selected.attachedAgents?.map((a: any) => (
                  <AttachedRow
                    key={a.id}
                    name={a.name}
                    onDetach={() => detachMutation.mutate({ connectorId: selected.id, agentId: a.id })}
                    pending={detachMutation.isPending}
                    label={t("conn.detach")}
                  />
                ))}
              </div>
            )}

            <div className="space-y-3">
              {selected.auth.fields.map((f: any) => (
                <div key={f.key}>
                  <label className="mb-1 block text-sm font-medium">
                    {f.label} {f.required && <span className="text-destructive">*</span>}
                  </label>
                  <Input
                    type={f.secret ? "password" : "text"}
                    placeholder={f.placeholder ?? ""}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                  {f.help && <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>}
                </div>
              ))}
            </div>

            <div className="mt-4">
              <h4 className="mb-2 text-sm font-semibold">{t("conn.actions")}</h4>
              <div className="space-y-2">
                {selected.actions.map((a: any) => (
                  <div key={a.id} className="rounded-xl bg-muted p-3 text-xs">
                    <span className="font-mono font-semibold text-primary">{a.id}</span>
                    <span className="ml-2 text-muted-foreground">{a.description}</span>
                    <span className="ml-2 opacity-60">→ {a.returns}</span>
                  </div>
                ))}
              </div>
            </div>

            {saveResult && (
              <p className={`mt-3 text-sm ${saveResult === "connected" ? "text-emerald-500" : "text-amber-500"}`}>
                {saveResult === "connected" ? `✓ ${t("conn.connected")}` : saveResult}
              </p>
            )}

            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} className="mt-4 w-full">
              <KeyRound />
              {targetAgentId ? t("conn.saveForAgent") : t("conn.save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Bitta biriktirma qatori + uzish tugmasi. */
function AttachedRow({
  name,
  onDetach,
  pending,
  label,
}: {
  name: string;
  onDetach: () => void;
  pending: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{name}</span>
      </span>
      <Button variant="destructive-ghost" size="sm" onClick={onDetach} loading={pending}>
        <Unplug /> {label}
      </Button>
    </div>
  );
}

function StatusBadge({ c, t }: { c: any; t: (k: string) => string }) {
  if (c.availability === "agreement_required")
    return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500">{t("conn.agreement")}</span>;
  if (c.connected)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500">
        <CheckCircle2 className="h-3 w-3" /> {t("conn.connected")}
      </span>
    );
  if (c.status === "needs_credentials")
    return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500">{t("conn.needsCreds")}</span>;
  return <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{t("conn.connect")}</span>;
}
