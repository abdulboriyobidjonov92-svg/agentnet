"use client";
import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Link2, User, Globe, Check, Scale, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT, LOCALES } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";

type Tab = "profile" | "values" | "security" | "integrations";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const api = useApiClient();
  const { t } = useT();

  const { data: profile, isError: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<any>("/users/me"),
  });

  const TABS = [
    { id: "profile" as Tab, label: t("settings.profile"), icon: User },
    { id: "values" as Tab, label: t("values.title"), icon: Scale },
    { id: "security" as Tab, label: t("settings.security"), icon: Shield },
    { id: "integrations" as Tab, label: t("settings.integrations"), icon: Link2 },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "profile" &&
        (profileError ? <ErrorState onRetry={() => refetchProfile()} /> : <ProfileTab profile={profile} />)}
      {tab === "values" && <ValuesTab />}
      {tab === "security" && <SecurityTab />}
      {tab === "integrations" && <IntegrationsTab />}
    </div>
  );
}

function ProfileTab({ profile }: { profile: any }) {
  const { t, locale, setLocale } = useT();
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <h2 className="mb-4 font-semibold">{t("settings.profile")}</h2>
        <div className="space-y-3">
          <Row label={t("settings.email")} value={profile?.email ?? "…"} />
          <Row label="Role" value={profile?.role ?? "MEMBER"} />
          <Row label={t("settings.businessAccount")} value={profile?.isBusinessAccount ? "✓" : "—"} />
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">{t("settings.language")}</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLocale(l.code)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border p-3 text-left transition",
                l.code === locale ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:bg-muted",
              )}
            >
              <span className="text-xl">{l.flag}</span>
              <span className="flex-1 text-sm font-medium">{l.label}</span>
              {l.code === locale && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function ValuesTab() {
  const { t } = useT();
  const api = useApiClient();
  const queryClient = useQueryClient();

  const { data: values } = useQuery({
    queryKey: ["values"],
    queryFn: () => api.get<{ tradition: string; statements: string[] }>("/users/me/values"),
  });

  const [tradition, setTradition] = useState("islamic");
  const [statements, setStatements] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [action, setAction] = useState("");
  const [checking, setChecking] = useState(false);
  const [verdict, setVerdict] = useState<any>(null);

  useEffect(() => {
    if (values) {
      setTradition(values.tradition ?? "islamic");
      setStatements((values.statements ?? []).join("\n"));
    }
  }, [values]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.patch("/users/me/values", {
        tradition,
        statements: statements.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      queryClient.invalidateQueries({ queryKey: ["values"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setVerdict(null);
    try {
      const res = await api.post<any>("/ethics/evaluate", { action: action.trim() });
      setVerdict(res);
    } catch (err: any) {
      setVerdict({ verdict: "REJECT", reasoning: err.message });
    } finally {
      setChecking(false);
    }
  };

  const TRADITIONS = [
    { id: "islamic", label: t("values.islamic") },
    { id: "secular", label: t("values.secular") },
    { id: "mixed", label: t("values.mixed") },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <h2 className="mb-1 font-semibold">{t("values.title")}</h2>
        <p className="mb-4 text-xs text-muted-foreground">{t("values.subtitle")}</p>

        <p className="mb-2 text-sm font-medium">{t("values.tradition")}</p>
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          {TRADITIONS.map((tr) => (
            <button
              key={tr.id}
              type="button"
              onClick={() => setTradition(tr.id)}
              className={cn(
                "rounded-xl border p-3 text-sm font-medium transition",
                tradition === tr.id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:bg-muted",
              )}
            >
              {tr.label}
            </button>
          ))}
        </div>

        <p className="mb-2 text-sm font-medium">{t("values.statements")}</p>
        <Textarea
          rows={5}
          value={statements}
          onChange={(e) => setStatements(e.target.value)}
          placeholder={t("values.statementsPh")}
          className="mb-3 resize-none"
        />
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : saved ? <Check /> : <Scale />}
          {saved ? t("values.saved") : t("values.save")}
        </Button>
      </div>

      <form onSubmit={check} className="rounded-2xl border bg-card p-6 shadow-soft">
        <h2 className="mb-3 font-semibold">{t("values.check")}</h2>
        <div className="flex gap-2">
          <Input
            required
            minLength={5}
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder={t("values.checkPh")}
            className="flex-1"
          />
          <Button type="submit" disabled={checking || action.trim().length < 5} className="h-11 shrink-0">
            {checking ? <Loader2 className="animate-spin" /> : <Shield />}
            {checking ? t("values.checking") : t("values.checkBtn")}
          </Button>
        </div>
        {verdict && (
          <div className="mt-3 rounded-xl border p-4 animate-in-up">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold",
                verdict.verdict === "APPROVE" && "bg-primary/10 text-primary",
                verdict.verdict === "CAUTION" && "bg-gold/10 text-gold",
                verdict.verdict === "REJECT" && "bg-destructive/10 text-destructive",
              )}
            >
              {t(`values.verdict.${verdict.verdict}`) !== `values.verdict.${verdict.verdict}`
                ? t(`values.verdict.${verdict.verdict}`)
                : verdict.verdict}
            </span>
            <p className="mt-2 text-sm">{verdict.reasoning}</p>
            {(verdict.value_alignment ?? []).length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {verdict.value_alignment.map((v: any, i: number) => (
                  <li key={i}>
                    <span className="font-medium">{v.value}</span> — {v.status}
                    {v.note ? `: ${v.note}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

function SecurityTab() {
  const { t } = useT();
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <h2 className="mb-4 font-semibold">{t("settings.security")}</h2>
      <div className="flex items-center gap-3 rounded-xl bg-secondary p-4">
        <Shield className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">2FA (TOTP)</p>
          <p className="text-xs text-muted-foreground">Google Authenticator · coming soon</p>
        </div>
      </div>
    </div>
  );
}

function IntegrationsTab() {
  const items = [
    { name: "Telegram Bot", desc: "Chat with agents via Telegram", status: "setup", color: "text-blue-600 bg-blue-500/10" },
    { name: "Google Calendar", desc: "Events and reminders", status: "soon", color: "text-muted-foreground bg-muted" },
    { name: "Payme", desc: "Uzbekistan payments", status: "sandbox", color: "text-gold bg-gold/10" },
    { name: "Click", desc: "Uzbekistan payments", status: "sandbox", color: "text-gold bg-gold/10" },
    { name: "Stripe", desc: "Global payments", status: "soon", color: "text-muted-foreground bg-muted" },
  ];
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <div key={i.name} className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-soft">
          <div>
            <p className="text-sm font-medium">{i.name}</p>
            <p className="text-xs text-muted-foreground">{i.desc}</p>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", i.color)}>{i.status}</span>
        </div>
      ))}
    </div>
  );
}
