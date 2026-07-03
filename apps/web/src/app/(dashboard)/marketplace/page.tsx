"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { Bot, Download, Search, Check, BadgeCheck, Star, TrendingUp, Wallet, Loader2 } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";

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
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<string[]>([]);
  const [installError, setInstallError] = useState<{ id: string; message: string } | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  const [ratingFor, setRatingFor] = useState<string | null>(null);

  const { data: agents } = useQuery({
    queryKey: ["marketplace", search],
    queryFn: () => api.getPublic<any[]>(`/marketplace${search ? `?search=${search}` : ""}`),
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
        <button
          onClick={() => setShowCreator((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-medium shadow-soft transition hover:shadow-lift"
        >
          <Wallet className="h-4 w-4 text-primary" /> {t("market.creator")}
        </button>
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
            <button
              onClick={() => payoutMutation.mutate()}
              disabled={payoutMutation.isPending || creator.balance_tiyin <= 0}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:brightness-110 disabled:opacity-50"
            >
              {payoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              {t("market.payout")}
            </button>
          </div>
          {!!creator.agents?.length && (
            <table className="mt-4 w-full text-sm">
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
          <p className="mt-2 text-xs text-muted-foreground">{creator.payout_note}</p>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder={t("common.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border bg-card py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </div>

      {!agents?.length ? (
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
                  <span className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-soft">
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
                <button
                  onClick={() => handleInstall(agent.id)}
                  disabled={installing === agent.id || installed.includes(agent.id)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:brightness-110 disabled:opacity-60"
                >
                  {installed.includes(agent.id) ? (
                    <><Check className="h-4 w-4" /> {t("market.installed")}</>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      {agent.marketplacePrice ? `${Math.round(agent.marketplacePrice / 100).toLocaleString()} so'm` : t("market.install")}
                    </>
                  )}
                </button>
                <button
                  onClick={() => setRatingFor(ratingFor === agent.id ? null : agent.id)}
                  title={t("market.rate")}
                  aria-label={t("market.rate")}
                  className="rounded-xl border px-3 py-2.5 text-sm transition hover:bg-muted"
                >
                  <Star className="h-4 w-4" />
                </button>
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
                      className="rounded-lg p-1.5 transition hover:bg-muted"
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
