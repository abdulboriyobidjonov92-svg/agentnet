"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Users, Zap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoHint } from "@/components/ui/info-hint";
import { ExpertPanel } from "@/components/fusion/expert-panel";
import { DailyPanel } from "@/components/fusion/daily-panel";

/**
 * Ilgari "Fyujn" va "Super rejim" deb ikkita alohida sahifa edi — ikkalasi
 * ham aslida bitta narsa qiladi: savolni ko'p nuqtai-nazardan tahlil qilish.
 * Endi bitta sahifa, ikki rejim: tezkor mutaxassis-fikri yoki to'liq
 * kun-boshqaruv quvur liniyasi (Life Twin + Goals konteksti bilan).
 */
type Mode = "experts" | "daily";

export default function ConsultPage() {
  const { t } = useT();
  const [mode, setMode] = useState<Mode>("experts");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-primary" /> {t("consult.title")}
          <InfoHint text={t("consult.hint")} label={t("consult.title")} />
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("consult.subtitle")}</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="inline-flex gap-1 rounded-xl border bg-card p-1 shadow-soft">
          <button
            type="button"
            onClick={() => setMode("experts")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition",
              mode === "experts" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Users className="h-4 w-4" /> {t("consult.tabExperts")}
          </button>
          <button
            type="button"
            onClick={() => setMode("daily")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition",
              mode === "daily" ? "bg-gold/10 text-gold" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Zap className="h-4 w-4" /> {t("consult.tabDaily")}
          </button>
        </div>
        <InfoHint
          text={mode === "experts" ? t("consult.hintExperts") : t("consult.hintDaily")}
          label={mode === "experts" ? t("consult.tabExperts") : t("consult.tabDaily")}
        />
      </div>

      {mode === "experts" ? <ExpertPanel /> : <DailyPanel />}
    </div>
  );
}
