"use client";
import { useT } from "@/lib/i18n/client";
import { BadgeCheck, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Kreator kabineti — daromad daftari (payout stub, hisob haqiqiy)
export function CreatorDashboard({
  creator,
  payingOut,
  onPayout,
}: {
  creator: any;
  payingOut: boolean;
  onPayout: () => void;
}) {
  const { t } = useT();

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{t("market.balance")}</p>
          <p className="text-2xl font-bold">{creator.balance_uzs.toLocaleString()} so'm</p>
          <p className="text-xs text-muted-foreground">
            Revenue share: {Math.round(creator.revenue_share.creator * 100)}% / {Math.round(creator.revenue_share.platform * 100)}%
          </p>
        </div>
        <Button onClick={onPayout} disabled={payingOut || creator.balance_tiyin <= 0}>
          {payingOut ? <Loader2 className="animate-spin" /> : <Wallet />}
          {t("market.payout")}
        </Button>
      </div>
      {!!creator.agents?.length && (
        <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1">Agent</th><th>{t("market.installs")}</th><th>{t("market.uses")}</th><th>★</th><th className="text-right">Narx</th>
            </tr>
          </thead>
          <tbody>
            {creator.agents.map((a: any) => (
              <tr key={a.id} className="border-t">
                <td className="py-1.5 font-medium">
                  {a.name} {a.verified && <BadgeCheck className="ml-1 inline h-3.5 w-3.5 text-primary" />}
                </td>
                <td>{a.installCount}</td>
                <td>{a.usageCount}</td>
                <td>{a.ratingAvg ? a.ratingAvg.toFixed(1) : "—"}</td>
                <td className="text-right">{a.marketplacePrice ? `${Math.round(a.marketplacePrice / 100).toLocaleString()} so'm` : "bepul"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
      {!!creator.ledger?.length && (
        <div className="mt-3 max-h-40 overflow-auto rounded-xl bg-muted p-3 text-xs">
          {creator.ledger.map((l: any) => (
            <div key={l.id} className="flex justify-between py-0.5">
              <span>{l.kind}</span>
              <span className={l.amount < 0 ? "text-destructive" : "text-emerald-500"}>
                {(l.amount / 100).toLocaleString()} so'm
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Y5: yaratuvchi bonusi — har yangi xaridorning birinchi to'lovida bir martalik, HAQIQIY balansga */}
      {!!creator.creatorBonus?.totalTiyin && (
        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t("market.creatorBonus")}</p>
            <p className="text-lg font-bold text-primary">{creator.creatorBonus.totalSom.toLocaleString()} so'm</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{creator.creatorBonus.note}</p>
          {!!creator.creatorBonus.payouts?.length && (
            <div className="mt-2 max-h-32 overflow-auto text-xs">
              {creator.creatorBonus.payouts.map((p: any) => (
                <div key={p.id} className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">{new Date(p.paidAt).toLocaleDateString()}</span>
                  <span className="text-emerald-500">+{(p.bonusAmountTiyin / 100).toLocaleString()} so'm</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{creator.payout_note}</p>
    </div>
  );
}
