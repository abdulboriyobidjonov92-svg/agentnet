"use client";
import { Check, Wand2, Loader2, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TemplateMatch } from "./compose-types";

/** Y9↔shablon: custom yaratishdan oldin topilgan tayyor (sinovdan o'tgan, tezroq) shablon taklifi.
 * Eslatma: custom yaratish endi BEPUL — shablon narxi ko'rsatiladi, lekin "arzonroq" degan
 * da'vo endi noto'g'ri (custom $0), shuning uchun taqqoslash tezlik/sifatga qaratilgan. */
export function TemplateSuggestionCard({
  suggestion,
  installing,
  generating,
  error,
  onBuy,
  onCustom,
  t,
  som,
}: {
  suggestion: TemplateMatch;
  installing: boolean;
  generating: boolean;
  error?: string;
  onBuy: () => void;
  onCustom: () => void;
  t: (k: string) => string;
  som: (n: number) => string;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="mb-1 flex items-center gap-2">
          <PackageCheck className="h-4 w-4 text-primary" />
          <h3 className="text-lg font-bold">{t("compose.templateFound")}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{t("compose.templateFoundDesc")}</p>
        <div className="mt-3 rounded-lg bg-background/60 p-3">
          <p className="font-semibold">{suggestion.profession}</p>
          <p className="text-sm text-muted-foreground">{suggestion.flagship}</p>
          <p className="mt-2 text-sm">
            {som(suggestion.price.createSom)} so'm{" "}
            <span className="text-xs text-muted-foreground">
              ({som(suggestion.price.monthlySom)} so'm/{t("compose.mo")})
            </span>
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button className="flex-1" onClick={onBuy} disabled={installing || generating}>
          {installing ? <Loader2 className="animate-spin" /> : <Check />} {t("compose.buyTemplate")}
        </Button>
        <Button variant="outline" onClick={onCustom} disabled={installing || generating}>
          {generating ? <Loader2 className="animate-spin" /> : <Wand2 />} {t("compose.useCustomAnyway")}
        </Button>
      </div>
    </div>
  );
}
