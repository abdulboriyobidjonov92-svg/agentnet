"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Landmark, Send, Loader2, MapPinned, ListChecks, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

/** S7: GovTech — fuqaro murojaati intake + marshrut + jarayon navigatori. */
export default function GovtechPage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const { t } = useT();
  const [text, setText] = useState("");
  const [fullName, setFullName] = useState("");
  const [guideQuery, setGuideQuery] = useState("");
  const [openReq, setOpenReq] = useState<string | null>(null);

  const { data: requests } = useQuery({ queryKey: ["gov-requests"], queryFn: () => api.get<any[]>("/govtech/requests") });

  const intake = useMutation({
    mutationFn: () => api.post<any>("/govtech/requests", { text, fullName: fullName || undefined }),
    onSuccess: () => { setText(""); setFullName(""); qc.invalidateQueries({ queryKey: ["gov-requests"] }); },
  });

  const guide = useMutation({ mutationFn: () => api.post<any>("/govtech/guide", { query: guideQuery }) });

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/govtech/requests/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gov-requests"] }),
  });

  const guideData = guide.data as any;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("gov.title")}</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">{t("gov.subtitle")}</p>
        <p className="mt-2 inline-block rounded-xl bg-amber-500/10 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400">
          {t("gov.liveNote")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Intake */}
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="mb-3 inline-flex items-center gap-2 font-semibold"><Landmark className="h-4 w-4 text-primary" /> {t("gov.intake")}</h2>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="F.I.Sh. (ixtiyoriy)" className="mb-2" />
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Murojaat matni: masalan, 'Bizning ko'chada 3 kundan beri suv yo'q...'"
          />
          <Button
            size="sm"
            onClick={() => intake.mutate()}
            disabled={!text.trim() || intake.isPending}
            className="mt-2"
          >
            {intake.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            OK
          </Button>
        </div>

        {/* Jarayon navigatori */}
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="mb-3 inline-flex items-center gap-2 font-semibold"><MapPinned className="h-4 w-4 text-primary" /> {t("gov.guide")}</h2>
          <div className="flex gap-2">
            <Input
              value={guideQuery}
              onChange={(e) => setGuideQuery(e.target.value)}
              placeholder="Masalan: 'Yangi pasport olish uchun nima qilaman?'"
              className="flex-1"
            />
            <Button onClick={() => guide.mutate()} disabled={!guideQuery.trim() || guide.isPending} className="h-11 shrink-0">
              {guide.isPending ? <Loader2 className="animate-spin" /> : "OK"}
            </Button>
          </div>
          {guideData && (
            <div className="mt-3 space-y-2 text-sm">
              <p className="font-semibold">{guideData.title}</p>
              {guideData.personalized_answer && <p>{guideData.personalized_answer}</p>}
              <ol className="list-decimal space-y-1 pl-5">
                {(guideData.steps ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}
              </ol>
              {!!guideData.documents?.length && (
                <p className="text-muted-foreground"><b>Hujjatlar:</b> {guideData.documents.join(", ")}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {guideData.where} {guideData.duration && `· ${guideData.duration}`} {guideData.fee_note && `· ${guideData.fee_note}`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Murojaatlar ro'yxati */}
      <div className="rounded-2xl border bg-card p-5 shadow-soft">
        <h2 className="mb-3 inline-flex items-center gap-2 font-semibold"><ListChecks className="h-4 w-4 text-primary" /> {t("gov.requests")}</h2>
        {!requests?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">—</p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="rounded-xl border p-3">
                <div className="flex cursor-pointer flex-wrap items-center gap-2" onClick={() => setOpenReq(openReq === r.id ? null : r.id)}>
                  <StatusPill status={r.status} />
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{r.category}</span>
                  {r.priority && <span className={`rounded-full px-2 py-0.5 text-xs ${r.priority === "urgent" ? "bg-destructive/15 text-destructive" : "bg-secondary"}`}>{r.priority}</span>}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.text}</span>
                </div>
                {openReq === r.id && (
                  <div className="mt-3 space-y-2 border-t pt-3 text-sm">
                    <p><b>Xizmat:</b> {r.service ?? "—"}</p>
                    <p><b>Idora:</b> {r.office ?? "—"}</p>
                    {(r.routing?.steps ?? []).length > 0 && (
                      <ol className="list-decimal pl-5 text-muted-foreground">
                        {r.routing.steps.map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ol>
                    )}
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {((r.timeline as any[]) ?? []).map((tl, i) => (
                        <p key={i}>• {new Date(tl.at).toLocaleString()} — <b>{tl.status}</b> {tl.note}</p>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      {["in_progress", "resolved", "rejected"].map((s) => (
                        <button
                          key={s}
                          onClick={() => advance.mutate({ id: r.id, status: s })}
                          disabled={r.status === s}
                          className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium transition hover:brightness-110 disabled:opacity-40"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "resolved" ? "bg-emerald-500/15 text-emerald-500" :
    status === "rejected" ? "bg-destructive/15 text-destructive" :
    status === "in_progress" ? "bg-primary/15 text-primary" :
    "bg-amber-500/15 text-amber-500";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      <CircleDot className="h-3 w-3" /> {status}
    </span>
  );
}
