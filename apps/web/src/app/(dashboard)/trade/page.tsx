"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Ship, FileText, ShieldCheck, PackageSearch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** S6: Cross-Border Trade — tarif, hujjat, muvofiqlik, kuzatuv, valyuta. */
export default function TradePage() {
  const api = useApiClient();
  const { t } = useT();
  const [tab, setTab] = useState<"tariff" | "docs" | "compliance" | "tracking">("tariff");

  const { data: fx } = useQuery({ queryKey: ["trade-fx"], queryFn: () => api.get<any>("/trade/fx") });

  const TABS = [
    { id: "tariff", label: t("trade.tariff"), icon: PackageSearch },
    { id: "docs", label: t("trade.docs"), icon: FileText },
    { id: "compliance", label: t("trade.compliance"), icon: ShieldCheck },
    { id: "tracking", label: t("trade.tracking"), icon: Ship },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("trade.title")}</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">{t("trade.subtitle")}</p>
      </div>

      {fx?.kurslar && (
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(fx.kurslar).map(([cur, val]: any) => (
            <span key={cur} className="rounded-full border bg-card px-3 py-1.5 shadow-soft">
              1 USD = <b>{Number(val).toLocaleString()}</b> {cur}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${tab === id ? "bg-primary text-primary-foreground shadow-soft" : "bg-card border text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "tariff" && <TariffTab api={api} />}
      {tab === "docs" && <DocsTab api={api} />}
      {tab === "compliance" && <ComplianceTab api={api} />}
      {tab === "tracking" && <TrackingTab api={api} />}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border bg-card p-5 shadow-soft">{children}</div>;
}

function RunBtn({ onClick, disabled, pending, label }: any) {
  return (
    <Button size="sm" onClick={onClick} disabled={disabled || pending}>
      {pending && <Loader2 className="animate-spin" />} {label}
    </Button>
  );
}

function TariffTab({ api }: { api: any }) {
  const [goods, setGoods] = useState("");
  const m = useMutation({ mutationFn: () => api.post("/trade/tariff", { goods }) });
  return (
    <Panel>
      <div className="flex gap-2">
        <input value={goods} onChange={(e) => setGoods(e.target.value)} placeholder="Tovar: masalan, 'smartfonlar Xitoydan'" className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none" />
        <RunBtn onClick={() => m.mutate()} disabled={!goods.trim()} pending={m.isPending} label="OK" />
      </div>
      {m.data != null ? (
        <div className="mt-4 space-y-2 text-sm">
          <p><b>HS bo'lim:</b> {(m.data as any).hs_chapter ?? "—"} — {(m.data as any).hs_label}</p>
          <p><b>Boj (taxminiy):</b> {(m.data as any).duty_pct_estimate ?? "—"}% · <b>QQS:</b> {(m.data as any).vat_pct}% · ishonch: {(m.data as any).confidence}</p>
          <p className="text-muted-foreground">{(m.data as any).explanation}</p>
          <p className="rounded-xl bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">{(m.data as any).disclaimer}</p>
        </div>
      ) : null}
    </Panel>
  );
}

function DocsTab({ api }: { api: any }) {
  const [goods, setGoods] = useState("");
  const [direction, setDirection] = useState("export");
  const [destination, setDestination] = useState("");
  const m = useMutation({
    mutationFn: () => api.post("/trade/customs-docs", { shipment: { goods, direction, destination } }),
  });
  return (
    <Panel>
      <div className="flex flex-wrap gap-2">
        <select value={direction} onChange={(e) => setDirection(e.target.value)} className="rounded-xl border bg-background px-3 py-2 text-sm outline-none">
          <option value="export">Eksport</option>
          <option value="import">Import</option>
        </select>
        <input value={goods} onChange={(e) => setGoods(e.target.value)} placeholder="Tovar" className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none" />
        <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Mamlakat" className="w-40 rounded-xl border bg-background px-3 py-2 text-sm outline-none" />
        <RunBtn onClick={() => m.mutate()} disabled={!goods.trim()} pending={m.isPending} label="OK" />
      </div>
      {m.data != null ? (
        <div className="mt-4 text-sm">
          <ol className="list-decimal space-y-1 pl-5">
            {((m.data as any).documents ?? []).map((d: any, i: number) => (
              <li key={i}><b>{d.name}</b>{d.where && <span className="text-muted-foreground"> — {d.where}</span>}</li>
            ))}
          </ol>
          {((m.data as any).notes ?? []).map((n: string, i: number) => (
            <p key={i} className="mt-2 text-xs text-muted-foreground">• {n}</p>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

function ComplianceTab({ api }: { api: any }) {
  const [goods, setGoods] = useState("");
  const [destination, setDestination] = useState("");
  const m = useMutation({ mutationFn: () => api.post("/trade/compliance", { goods, destination }) });
  const data = m.data as any;
  return (
    <Panel>
      <div className="flex flex-wrap gap-2">
        <input value={goods} onChange={(e) => setGoods(e.target.value)} placeholder="Tovar / kontragent" className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none" />
        <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Yo'nalish (mamlakat)" className="w-48 rounded-xl border bg-background px-3 py-2 text-sm outline-none" />
        <RunBtn onClick={() => m.mutate()} disabled={!goods.trim()} pending={m.isPending} label="OK" />
      </div>
      {data && (
        <div className="mt-4 space-y-2 text-sm">
          <p className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${data.status === "flagged" ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-500"}`}>
            {data.status}
          </p>
          {(data.flags ?? []).map((f: any, i: number) => (
            <p key={i} className="rounded-xl bg-destructive/10 p-2 text-xs"><b>{f.type}</b> ({f.match}): {f.action}</p>
          ))}
          <p>{data.assessment}</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {(data.recommended_steps ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}
          </ul>
          <p className="text-xs text-muted-foreground">{data.screen_note}</p>
        </div>
      )}
    </Panel>
  );
}

function TrackingTab({ api }: { api: any }) {
  const [tn, setTn] = useState("");
  const m = useMutation({ mutationFn: () => api.get(`/trade/tracking/${encodeURIComponent(tn)}`) });
  const data = m.data as any;
  return (
    <Panel>
      <div className="flex gap-2">
        <input value={tn} onChange={(e) => setTn(e.target.value)} placeholder="Trek-raqam (masalan, 1Z... yoki RR123456789UZ)" className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none" />
        <RunBtn onClick={() => m.mutate()} disabled={!tn.trim()} pending={m.isPending} label="OK" />
      </div>
      {data && (
        <div className="mt-4 space-y-2 text-sm">
          <p><b>Tashuvchi (aniqlangan):</b> {data.carrier_guess}</p>
          <p className="text-xs text-muted-foreground">{data.live_note}</p>
          <div className="flex gap-2 text-xs">
            {Object.entries(data.manual_links ?? {}).map(([k, v]: any) => (
              <a key={k} href={v} target="_blank" rel="noreferrer" className="rounded-full bg-secondary px-3 py-1 text-primary hover:underline">{k} ↗</a>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
