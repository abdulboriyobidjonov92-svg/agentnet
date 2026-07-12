"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { blockedMessage } from "@/lib/api-client";
import { Sparkles, Loader2, ArrowRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

// Bosqich 1: erkin matnli tavsif
export function DescribeStep({
  text,
  setText,
  city,
  setCity,
  analyzing,
  error,
  blockedReason,
  onSubmit,
}: {
  text: string;
  setText: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  analyzing: boolean;
  error: string;
  blockedReason: string | null;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const { t } = useT();

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-gold bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
          <Sparkles className="h-3 w-3" /> AgentNet
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{t("onb.title")}</h1>
        <p className="mx-auto max-w-lg text-sm text-muted-foreground">{t("onb.subtitle")}</p>
      </div>

      {blockedReason !== null && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <ShieldAlert className="h-4 w-4 shrink-0" />{" "}
          {blockedMessage(blockedReason, t, { plain: "onb.blocked", withReason: "onb.blockedReason" })}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Textarea
        required
        rows={5}
        minLength={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("onb.placeholder")}
        className="resize-none rounded-2xl bg-card px-5 py-4 shadow-soft"
      />

      <div className="space-y-1.5">
        <label htmlFor="onb-city" className="text-sm font-medium">{t("onb.city")}</label>
        <Input
          id="onb-city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder={t("onb.cityPlaceholder")}
          className="bg-card"
        />
      </div>

      <Button type="submit" size="lg" disabled={analyzing || text.trim().length < 3} className="group w-full">
        {analyzing ? (
          <>
            <Loader2 className="animate-spin" /> {t("onb.analyzing")}
          </>
        ) : (
          <>
            {t("onb.analyze")}
            <ArrowRight className="transition group-hover:translate-x-0.5" />
          </>
        )}
      </Button>

      <p className="text-center">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
          {t("onb.skip")}
        </Link>
      </p>
    </form>
  );
}
