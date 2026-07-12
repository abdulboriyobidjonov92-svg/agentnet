"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Fireworks } from "@/components/three/fireworks";
import { Building2, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function WorkspaceSetup() {
  const api = useApiClient();
  const { t } = useT();
  const queryClient = useQueryClient();

  const [wsName, setWsName] = useState("");
  const [wsKind, setWsKind] = useState("company");
  const [wsIndustry, setWsIndustry] = useState("");
  const [creating, setCreating] = useState(false);
  const [burst, setBurst] = useState(0);

  const createWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/agentos/workspace", { name: wsName.trim(), kind: wsKind, tier: wsKind === "government" ? "gov" : "mid", industry: wsIndustry.trim() });
      queryClient.invalidateQueries({ queryKey: ["agentos-workspace"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setBurst((b) => b + 1);
    } finally {
      setCreating(false);
    }
  };

  const KINDS = [
    { id: "company", label: t("os.kindCompany") },
    { id: "startup", label: t("os.kindStartup") },
    { id: "government", label: t("os.kindGov") },
    { id: "enterprise", label: t("os.kindEnterprise") },
  ];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Fireworks trigger={burst} />
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-glow">
          <Building2 className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold">{t("os.setupTitle")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t("os.setupSub")}</p>
      </div>

      <form onSubmit={createWorkspace} className="space-y-4 rounded-2xl border border-white/10 glass-panel p-6">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("os.orgName")}</label>
          <input
            required
            minLength={2}
            value={wsName}
            onChange={(e) => setWsName(e.target.value)}
            placeholder={t("os.orgNamePh")}
            className="w-full rounded-xl border bg-background/60 px-4 py-3 text-sm outline-none transition focus:border-primary"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("os.orgKind")}</label>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setWsKind(k.id)}
                className={cn(
                  "rounded-xl border p-2.5 text-sm font-medium transition",
                  wsKind === k.id ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("os.industry")}</label>
          <input
            value={wsIndustry}
            onChange={(e) => setWsIndustry(e.target.value)}
            placeholder={t("os.industryPh")}
            className="w-full rounded-xl border bg-background/60 px-4 py-3 text-sm outline-none transition focus:border-primary"
          />
        </div>
        <Button type="submit" disabled={creating || wsName.trim().length < 2} className="w-full">
          {creating ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {t("os.create")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{t("os.createNote")}</p>
      </form>
    </div>
  );
}
