"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Users, CalendarClock, Wallet, Send, Loader2, Plus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

/** S5: Business Operations — jadval, ish haqi, tashqi xabarlar. */
export default function OperationsPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const { t } = useT();

  const [empName, setEmpName] = useState("");
  const [empRate, setEmpRate] = useState("");
  const [instructions, setInstructions] = useState("");
  const [schedulePlan, setSchedulePlan] = useState<any>(null);
  const [payFrom, setPayFrom] = useState(() => firstOfMonth());
  const [payTo, setPayTo] = useState(() => today());
  const [payroll, setPayroll] = useState<any>(null);
  const [obPurpose, setObPurpose] = useState("");
  const [obContact, setObContact] = useState("");
  const [obAudience, setObAudience] = useState("client");
  const [obChannel, setObChannel] = useState("telegram");

  const { data: employees } = useQuery({ queryKey: ["ops-employees"], queryFn: () => api.get<any[]>("/operations/employees") });
  const { data: shifts } = useQuery({ queryKey: ["ops-shifts"], queryFn: () => api.get<any[]>("/operations/shifts") });
  const { data: outbound } = useQuery({ queryKey: ["ops-outbound"], queryFn: () => api.get<any[]>("/operations/outbound") });

  const addEmp = useMutation({
    mutationFn: () => api.post("/operations/employees", {
      name: empName,
      hourlyRate: empRate ? Math.round(Number(empRate) * 100) : undefined,
    }),
    onSuccess: () => { setEmpName(""); setEmpRate(""); qc.invalidateQueries({ queryKey: ["ops-employees"] }); },
  });

  const genSchedule = useMutation({
    mutationFn: () => api.post<any>("/operations/schedule/generate", { instructions }),
    onSuccess: (data) => { setSchedulePlan(data); qc.invalidateQueries({ queryKey: ["ops-shifts"] }); },
  });

  const runPayroll = useMutation({
    mutationFn: () => api.get<any>(`/operations/payroll?from=${payFrom}&to=${payTo}`),
    onSuccess: setPayroll,
  });

  const draftOb = useMutation({
    mutationFn: () => api.post("/operations/outbound/draft", {
      purpose: obPurpose, audience: obAudience, channel: obChannel, recipientContact: obContact,
    }),
    onSuccess: () => { setObPurpose(""); qc.invalidateQueries({ queryKey: ["ops-outbound"] }); },
  });

  const sendOb = useMutation({
    mutationFn: (id: string) => api.post(`/operations/outbound/${id}/send`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ops-outbound"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("ops.title")}</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">{t("ops.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Xodimlar */}
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="mb-3 inline-flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-primary" /> {t("ops.employees")}</h2>
          <div className="mb-3 flex gap-2">
            <Input value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="Ism" className="flex-1" />
            <Input value={empRate} onChange={(e) => setEmpRate(e.target.value)} placeholder="Soatlik (so'm)" className="w-36" />
            <Button size="icon" onClick={() => addEmp.mutate()} disabled={!empName.trim() || addEmp.isPending} aria-label={t("ops.employees")} className="h-11 shrink-0">
              <Plus />
            </Button>
          </div>
          {employees?.map((e) => (
            <div key={e.id} className="flex items-center justify-between border-t py-2 text-sm">
              <span className="font-medium">{e.name}</span>
              <span className="text-muted-foreground">{e.hourlyRate ? `${Math.round(e.hourlyRate / 100).toLocaleString()} so'm/soat` : "—"}</span>
            </div>
          ))}
        </div>

        {/* Jadval generatori */}
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="mb-3 inline-flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4 text-primary" /> {t("ops.schedule")}</h2>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            placeholder={"Do'kon 9-21 ochiq, har kuni 2 kishi kerak. Alisher juma ishlamaydi."}
          />
          <Button
            size="sm"
            onClick={() => genSchedule.mutate()}
            disabled={!instructions.trim() || genSchedule.isPending}
            className="mt-2"
          >
            {genSchedule.isPending ? <Loader2 className="animate-spin" /> : <CalendarClock />}
            {t("ops.scheduleGen")}
          </Button>
          {schedulePlan && (
            <p className="mt-2 text-xs text-muted-foreground">
              ✓ {schedulePlan.created} smena ({schedulePlan.method}). {schedulePlan.reasoning}
            </p>
          )}
          {!!shifts?.length && (
            <div className="mt-3 max-h-48 overflow-auto rounded-xl bg-muted p-3">
              {shifts.map((s) => (
                <div key={s.id} className="flex justify-between py-0.5 text-xs">
                  <span>{s.date} · {s.startTime}–{s.endTime}</span>
                  <span className="font-medium">{s.employee?.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ish haqi */}
      <div className="rounded-2xl border bg-card p-5 shadow-soft">
        <h2 className="mb-3 inline-flex items-center gap-2 font-semibold"><Wallet className="h-4 w-4 text-primary" /> {t("ops.payroll")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={payFrom} onChange={(e) => setPayFrom(e.target.value)} className="rounded-xl border bg-background px-3 py-2 text-sm outline-none" />
          <span className="text-muted-foreground">—</span>
          <input type="date" value={payTo} onChange={(e) => setPayTo(e.target.value)} className="rounded-xl border bg-background px-3 py-2 text-sm outline-none" />
          <Button size="sm" onClick={() => runPayroll.mutate()} disabled={runPayroll.isPending}>
            {runPayroll.isPending ? "…" : "Hisoblash"}
          </Button>
        </div>
        {payroll && (
          <div className="mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1">Xodim</th><th>Soat</th><th>Stavka turi</th><th className="text-right">Jami (so'm)</th>
                </tr>
              </thead>
              <tbody>
                {payroll.rows.map((r: any) => (
                  <tr key={r.employeeId} className="border-t">
                    <td className="py-1.5 font-medium">{r.name}</td>
                    <td>{r.hours}</td>
                    <td className="text-xs text-muted-foreground">{r.rate_type}</td>
                    <td className="text-right font-semibold">{r.gross_uzs.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="border-t font-bold">
                  <td className="py-1.5">Jami</td>
                  <td>{payroll.totals.hours}</td>
                  <td />
                  <td className="text-right">{payroll.totals.gross_uzs.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">{payroll.note}</p>
          </div>
        )}
      </div>

      {/* Tashqi xabarlar */}
      <div className="rounded-2xl border bg-card p-5 shadow-soft">
        <h2 className="mb-3 inline-flex items-center gap-2 font-semibold"><Send className="h-4 w-4 text-primary" /> {t("ops.outbound")}</h2>
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Input value={obPurpose} onChange={(e) => setObPurpose(e.target.value)} placeholder="Maqsad: to'lov eslatmasi, taklif..." className="lg:col-span-2" />
          <Input value={obContact} onChange={(e) => setObContact(e.target.value)} placeholder="Qabul qiluvchi (chat_id/email/tel)" />
          <div className="flex gap-2">
            <select value={obAudience} onChange={(e) => setObAudience(e.target.value)} className="flex-1 rounded-xl border bg-background px-2 py-2 text-sm outline-none">
              <option value="client">Mijoz</option><option value="partner">Hamkor</option><option value="sponsor">Homiy</option>
            </select>
            <select value={obChannel} onChange={(e) => setObChannel(e.target.value)} className="flex-1 rounded-xl border bg-background px-2 py-2 text-sm outline-none">
              <option value="telegram">Telegram</option><option value="email">Email</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option>
            </select>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => draftOb.mutate()}
          disabled={!obPurpose.trim() || !obContact.trim() || draftOb.isPending}
        >
          {draftOb.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          {t("ops.draft")}
        </Button>

        {!!outbound?.length && (
          <div className="mt-4 space-y-3">
            {outbound.map((m) => (
              <div key={m.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-secondary px-2 py-0.5">{m.audience}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5">{m.channel} → {m.recipientContact}</span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${m.status === "sent" ? "bg-emerald-500/15 text-emerald-500" : m.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-500"}`}>
                    {m.status}
                  </span>
                </div>
                {m.subject && <p className="mt-2 text-sm font-semibold">{m.subject}</p>}
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{m.body}</p>
                {m.status === "draft" && (
                  <button
                    onClick={() => sendOb.mutate(m.id)}
                    disabled={sendOb.isPending}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> {t("ops.approveSend")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
