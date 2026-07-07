"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { Bot, Download, Search, Check, BadgeCheck, Star, TrendingUp, Wallet, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/components/ui/toast";

/**
 * S8: Marketplace — haqiqiy bozor dinamikasi.
 * Reyting = haqiqiy foydalanish + o'rnatishlar + baholar; verified = sifat
 * chegarasi; kreator kabineti = daromad daftari (payout stub, hisob haqiqiy).
 */
export default function MarketplacePage() {
  const api = useApiClient();
  const qc = useQueryClient();
  const { t } = useT();
  const [search, setSearch] = useState("");
  // 300ms debounce — har tugma bosishda server so'rovi ketmasligi uchun
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<string[]>([]);
  const [installError, setInstallError] = useState<{ id: string; message: string } | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  const [ratingFor, setRatingFor] = useState<string | null>(null);

  const { data: agents, isError, refetch } = useQuery({
    queryKey: ["marketplace", debouncedSearch],
    queryFn: () =>
      api.getPublic<any[]>(
        `/marketplace${debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ""}`,
      ),
  });

  const { data: creator } = useQuery({
    queryKey: ["creator-dashboard"],
    queryFn: () => api.get<any>("/marketplace/creator/dashboard"),
    enabled: showCreator,
  });

  const installMutation = useMutation({
    mutationFn: (agentId: string) => api.post<any>(`/marketplace/${agentId}/install`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["marketplace"] });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ agentId, rating }: { agentId: string; rating: number }) =>
      api.post(`/marketplace/${agentId}/reviews`, { rating }),
    onSuccess: () => {
      setRatingFor(null);
      qc.invalidateQueries({ queryKey: ["marketplace"] });
    },
  });

  const payoutMutation = useMutation({
    mutationFn: () => api.post<any>("/marketplace/creator/payout", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["creator-dashboard"] }),
  });

  const handleInstall = async (id: string) => {
    setInstalling(id);
    setInstallError(null);
    try {
      await installMutation.mutateAsync(id);
      setInstalled((p) => [...p, id]);
      toast({ title: t("market.installed") });
    } catch (e) {
      setInstallError({ id, message: e instanceof Error ? e.message : t("common.error") });
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("market.title")}</h1>
          <p className="mt-1 inline-flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-primary" /> {t("market.leaderboard")}
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowCreator((v) => !v)}>
          <Wallet className="text-primary" /> {t("market.creator")}
        </Button>
      </div>

      {/* Kreator kabineti */}
      {showCreator && creator && (
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{t("market.balance")}</p>
              <p className="text-2xl font-bold">{creator.balance_uzs.toLocaleString()} so'm</p>
              <p className="text-xs text-muted-foreground">
                Revenue share: {Math.round(creator.revenue_share.creator * 100)}% / {Math.round(creator.revenue_share.platform * 100)}%
              </p>
            </div>
            <Button
              onClick={() => payoutMutation.mutate()}
              disabled={payoutMutation.isPending || creator.balance_tiyin <= 0}
            >
              {payoutMutation.isPending ? <Loader2 className="animate-spin" /> : <Wallet />}
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
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t("common.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-card pl-10"
        />
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !agents?.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("market.community")}: — (nashr etilgan agentlar shu yerda reyting bilan chiqadi)
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent: any) => (
            <div key={agent.id} className="flex flex-col rounded-2xl border bg-card p-5 shadow-soft transition hover:shadow-lift">
              <div className="mb-3 flex items-start gap-3">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Bot className="h-5 w-5" />
                  <span className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow-soft">
                    {agent.rank}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="flex items-center gap-1.5 font-semibold">
                    <span className="truncate">{agent.name}</span>
                    {agent.verified && (
                      <span title={t("market.verified")}>
                        <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
                      </span>
                    )}
                  </h3>
                  {agent.user?.email && <p className="truncate text-xs text-muted-foreground">by {agent.user.email}</p>}
                </div>
              </div>

              {agent.description && <p className="mb-2 text-sm text-muted-foreground">{agent.description}</p>}

              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-gold" />
                  {agent.ratingAvg ? `${agent.ratingAvg.toFixed(1)} (${agent.ratingCount})` : "—"}
                </span>
                <span>· {agent.installCount} {t("market.installs")}</span>
                <span>· {agent.usageCount} {t("market.uses")}</span>
                {agent.vertical && <span className="rounded-full bg-secondary px-2 py-0.5">{agent.vertical}</span>}
              </div>

              <div className="mt-auto flex gap-2">
                <Button
                  onClick={() => handleInstall(agent.id)}
                  disabled={installing === agent.id || installed.includes(agent.id)}
                  className="flex-1"
                >
                  {installed.includes(agent.id) ? (
                    <><Check /> {t("market.installed")}</>
                  ) : (
                    <>
                      <Download />
                      {agent.marketplacePrice ? `${Math.round(agent.marketplacePrice / 100).toLocaleString()} so'm` : t("market.install")}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setRatingFor(ratingFor === agent.id ? null : agent.id)}
                  title={t("market.rate")}
                  aria-label={t("market.rate")}
                >
                  <Star />
                </Button>
              </div>

              {installError && installError.id === agent.id && (
                <p role="alert" className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {installError.message}
                </p>
              )}

              {ratingFor === agent.id && (
                <div className="mt-2 flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      onClick={() => reviewMutation.mutate({ agentId: agent.id, rating: r })}
                      aria-label={`${t("market.rate")}: ${r}/5`}
                      className="rounded-lg p-2.5 transition hover:bg-muted"
                    >
                      <Star className="h-5 w-5 text-gold" fill="currentColor" fillOpacity={0.4} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
