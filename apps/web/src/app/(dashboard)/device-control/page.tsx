"use client";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import {
  Globe, Play, Loader2, CheckCircle2, XCircle, ShieldAlert, Monitor, Smartphone,
  Shield, Lock, FlaskConical, Power, History, Mic, Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

type TFn = (k: string) => string;
type DeviceStatus = {
  deviceType: string;
  connected: boolean;
  categories: { category: string; enabled: boolean }[];
};

type StepEvent = {
  step: number;
  action: string;
  target?: string | null;
  observation: string;
  url?: string | null;
};

type RunState = "idle" | "running" | "done" | "error";

const EXAMPLES = [
  "example.com saytini ochib, sarlavha va asosiy matnni o'qib ber",
  "https://uz.wikipedia.org/wiki/Sun'iy_intellekt sahifasini ochib, qisqacha xulosa qil",
  "news.ycombinator.com ni ochib, birinchi 5 ta sarlavhani o'qib ber",
];

export default function DeviceControlPage() {
  const { t } = useT();
  const [goal, setGoal] = useState("");
  const [startUrl, setStartUrl] = useState("");
  const [runState, setRunState] = useState<RunState>("idle");
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [statusLine, setStatusLine] = useState("");
  const [summary, setSummary] = useState("");
  const [extracted, setExtracted] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [finalStatus, setFinalStatus] = useState<string>("");
  const logRef = useRef<HTMLDivElement>(null);

  const scrollLog = () =>
    requestAnimationFrame(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }));

  const run = async () => {
    if (!goal.trim() || runState === "running") return;
    setRunState("running");
    setSteps([]);
    setSummary("");
    setExtracted("");
    setScreenshot(null);
    setFinalStatus("");
    setStatusLine(t("device.starting"));

    try {
      const res = await fetch("/api/device/browser/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim(), startUrl: startUrl.trim() || undefined }),
      });
      if (!res.ok || !res.body) throw new Error(t("device.noStream"));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handle = (ev: any) => {
        switch (ev.type) {
          case "start":
            setStatusLine(t("device.planning"));
            break;
          case "browser_ready":
            setStatusLine(t("device.browserReady"));
            break;
          case "step":
            setSteps((prev) => [...prev, ev as StepEvent]);
            setStatusLine(`${ev.step}. ${ev.action} ${ev.target ?? ""}`.trim());
            scrollLog();
            break;
          case "screenshot":
            setScreenshot(ev.image);
            break;
          case "rate_limit":
            setStatusLine("");
            setFinalStatus("blocked");
            setSummary(`⏳ ${ev.message}`);
            break;
          case "error":
            setFinalStatus("failed");
            setSummary(`⚠️ ${ev.message}`);
            break;
          case "interrupted":
            setStatusLine("");
            break;
          case "done":
            setFinalStatus(ev.status);
            setSummary(ev.summary ?? "");
            setExtracted(ev.extracted ?? "");
            setStatusLine("");
            break;
        }
      };

      const drain = (flush = false) => {
        const parts = buffer.split("\n");
        buffer = flush ? "" : parts.pop() ?? "";
        for (const line of parts) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            handle(JSON.parse(raw));
          } catch {
            /* incomplete/invalid line */
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        drain();
      }
      buffer += decoder.decode();
      drain(true);
      setRunState((s) => (s === "running" ? "done" : s));
    } catch (e: any) {
      setFinalStatus("failed");
      setSummary(`⚠️ ${e.message}`);
      setRunState("error");
    } finally {
      setRunState((s) => (s === "running" ? "done" : s));
      setStatusLine("");
    }
  };

  // BOSQICH 4 — barge-in: joriy yurgizishni DARHOL to'xtatadi (interrupt signali).
  const stop = () => {
    fetch("/api/backend/device/interrupt", { method: "POST" }).catch(() => null);
    setStatusLine(t("device.stopping"));
  };

  // BOSQICH 4 — ovozli buyruq (brauzer Web Speech API — bepul, kalitsiz).
  const [listening, setListening] = useState(false);
  const startVoice = () => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return alert(t("device.noVoice"));
    const rec = new SR();
    rec.lang = "uz-UZ";
    rec.interimResults = false;
    rec.onresult = (e: any) => setGoal(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const busy = runState === "running";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Sarlavha + beta belgisi */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{t("device.title")}</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600">
            <FlaskConical className="h-3.5 w-3.5" /> {t("device.beta")}
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-muted-foreground">{t("device.subtitle")}</p>
      </div>

      {/* Xavfsizlik-modeli banneri (halol chegaralar) */}
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
        <div className="flex gap-3">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-amber-700">{t("device.sandboxTitle")}</p>
            <p className="text-muted-foreground">{t("device.sandboxBody")}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> {t("device.sandboxLogin")}
            </p>
          </div>
        </div>
      </div>

      {/* Brauzer-agent kartasi */}
      <div className="rounded-2xl border bg-card p-5 shadow-soft">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">{t("device.browserAgent")}</h2>
            <p className="text-xs text-muted-foreground">{t("device.browserAgentHint")}</p>
          </div>
        </div>

        <label className="mb-1.5 block text-sm font-medium">{t("device.command")}</label>
        <Textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder={t("device.commandPh")}
          rows={3}
          disabled={busy}
        />

        {/* Misollar */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={busy}
              onClick={() => setGoal(ex)}
              className="rounded-full border bg-secondary/50 px-2.5 py-1 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-50"
            >
              {ex.length > 44 ? ex.slice(0, 44) + "…" : ex}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={startUrl}
            onChange={(e) => setStartUrl(e.target.value)}
            placeholder={t("device.startUrl")}
            className="flex-1"
            disabled={busy}
          />
          <Button
            variant="outline"
            onClick={startVoice}
            disabled={busy || listening}
            aria-label={t("device.voice")}
            title={t("device.voice")}
          >
            <Mic className={listening ? "animate-pulse text-destructive" : ""} />
          </Button>
          {busy ? (
            <Button variant="destructive" onClick={stop}>
              <Square /> {t("device.stop")}
            </Button>
          ) : (
            <Button onClick={run} disabled={!goal.trim()}>
              <Play /> {t("device.run")}
            </Button>
          )}
        </div>
      </div>

      {/* Jonli qadam-log */}
      {(busy || steps.length > 0 || summary) && (
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{t("device.liveLog")}</h3>
            {finalStatus && (
              <span className="inline-flex items-center gap-1.5 text-xs">
                {finalStatus === "completed" ? (
                  <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {t("device.completed")}</>
                ) : finalStatus === "blocked" ? (
                  <><ShieldAlert className="h-4 w-4 text-amber-500" /> {t("device.blocked")}</>
                ) : finalStatus === "interrupted" ? (
                  <><Square className="h-4 w-4 text-amber-500" /> {t("device.interrupted")}</>
                ) : (
                  <><XCircle className="h-4 w-4 text-destructive" /> {t("device.failed")}</>
                )}
              </span>
            )}
          </div>

          <div ref={logRef} className="max-h-72 space-y-1.5 overflow-auto rounded-xl bg-muted/50 p-3 font-mono text-xs">
            {steps.map((s, i) => (
              <div key={i} className="flex gap-2">
                <span className="shrink-0 text-primary">{s.step}.</span>
                <span className="shrink-0 font-semibold">{s.action}</span>
                {s.target && <span className="shrink-0 text-muted-foreground">{s.target}</span>}
                <span className="truncate opacity-70">— {s.observation}</span>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {statusLine || t("device.working")}
              </div>
            )}
            {!busy && steps.length === 0 && !summary && (
              <p className="text-muted-foreground">{t("device.logEmpty")}</p>
            )}
          </div>

          {summary && <p className="mt-3 text-sm">{summary}</p>}

          {extracted && (
            <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs">
              {extracted}
            </pre>
          )}

          {screenshot && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs text-muted-foreground">{t("device.screenshotLabel")}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={screenshot} alt="agent view" className="w-full rounded-xl border" />
            </div>
          )}
        </div>
      )}

      {/* BOSQICH 1 — qurilma modullari + ruxsat-oqimi */}
      <div>
        <h2 className="mb-1 font-semibold">{t("device.perms")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("device.permsIntro")}</p>
        <DeviceModulesSection t={t} />
      </div>

      {/* Xavfsizlik jurnali */}
      <SecurityLogSection t={t} />
    </div>
  );
}

/** Ruxsat toggle'i (inline — UI'da switch komponenti yo'q). */
function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

/** BOSQICH 1 — ikki mustaqil qurilma-moduli (Kompyuter, Telefon) + ruxsatlar. */
function DeviceModulesSection({ t }: { t: TFn }) {
  const api = useApiClient();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["device-status"],
    queryFn: () => api.get<{ devices: DeviceStatus[] }>("/device/status"),
  });
  const connectMut = useMutation({
    mutationFn: (deviceType: string) => api.post("/device/connect", { deviceType }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["device-status"] }),
  });
  const permMut = useMutation({
    mutationFn: (v: { deviceType: string; category: string; enabled: boolean }) =>
      api.patch("/device/permission", v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["device-status"] });
      qc.invalidateQueries({ queryKey: ["device-actions"] });
    },
  });

  const devices = data?.devices ?? [];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {devices.map((d) => {
        const isPhone = d.deviceType === "phone";
        const Icon = isPhone ? Smartphone : Monitor;
        return (
          <div key={d.deviceType} className="rounded-2xl border bg-card p-5 shadow-soft">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="font-medium">
                  {t(isPhone ? "device.phoneAgent" : "device.computerAgent")}
                </p>
              </div>
              {d.connected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {t("device.connectedLabel")}
                </span>
              ) : (
                <Button size="sm" variant="outline" onClick={() => connectMut.mutate(d.deviceType)} disabled={connectMut.isPending}>
                  <Power className="h-4 w-4" /> {t("device.connect")}
                </Button>
              )}
            </div>

            {d.connected ? (
              <div className="space-y-2">
                {d.categories.map((c) => (
                  <div key={c.category} className="flex items-center justify-between gap-3 rounded-xl border bg-background/50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t(`device.cat.${c.category}`)}</p>
                      <p className="text-xs text-muted-foreground">{t(`device.catHint.${c.category}`)}</p>
                    </div>
                    <Toggle
                      enabled={c.enabled}
                      disabled={permMut.isPending}
                      onChange={(enabled) => permMut.mutate({ deviceType: d.deviceType, category: c.category, enabled })}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t(isPhone ? "device.phoneAgentHint" : "device.computerAgentHint")}
              </p>
            )}

            {isPhone && (
              <p className="mt-3 flex gap-1.5 text-xs text-amber-600">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t("device.iosNote")}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Xavfsizlik jurnali — agent bajargan har harakat. */
function SecurityLogSection({ t }: { t: TFn }) {
  const api = useApiClient();
  const { data: logs } = useQuery({
    queryKey: ["device-actions"],
    queryFn: () => api.get<any[]>("/device/actions"),
  });

  const dot = (status: string) =>
    status === "ok" ? "bg-emerald-500" : status === "blocked" ? "bg-amber-500" : "bg-destructive";

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="mb-1 flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">{t("device.securityLog")}</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{t("device.securityLogHint")}</p>
      {logs?.length ? (
        <div className="space-y-1.5">
          {logs.map((l) => (
            <div key={l.id} className="flex items-center gap-2 text-xs">
              <span className={`h-2 w-2 shrink-0 rounded-full ${dot(l.status)}`} />
              <span className="shrink-0 text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</span>
              <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{l.deviceType}</span>
              <span className="truncate font-medium">{l.action}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("device.noLogs")}</p>
      )}
    </div>
  );
}
