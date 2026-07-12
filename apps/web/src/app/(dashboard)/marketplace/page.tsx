"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { Search, TrendingUp, Wallet, LayoutTemplate } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/components/ui/toast";
import { CreatorDashboard } from "@/components/marketplace/creator-dashboard";
import { AgentCard } from "@/components/marketplace/agent-card";

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
          <p className="mt-1 text-sm text-muted-foreground">{t("market.subtitle")}</p>
          <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-primary" /> {t("market.leaderboard")}
          </p>
          <Link href="/templates" className="mt-1 flex items-center gap-1.5 text-xs text-primary hover:underline">
            <LayoutTemplate className="h-3.5 w-3.5" /> {t("market.wantOfficial")}
          </Link>
        </div>
        <Button variant="outline" onClick={() => setShowCreator((v) => !v)}>
          <Wallet className="text-primary" /> {t("market.creator")}
        </Button>
      </div>

      {showCreator && creator && (
        <CreatorDashboard creator={creator} payingOut={payoutMutation.isPending} onPayout={() => payoutMutation.mutate()} />
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
        <p className="py-10 text-center text-sm text-muted-foreground">{t("market.empty")}</p>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("market.community")}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent: any) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                installing={installing === agent.id}
                installed={installed.includes(agent.id)}
                installErrorMessage={installError && installError.id === agent.id ? installError.message : null}
                ratingOpen={ratingFor === agent.id}
                onInstall={() => handleInstall(agent.id)}
                onToggleRating={() => setRatingFor(ratingFor === agent.id ? null : agent.id)}
                onRate={(rating) => reviewMutation.mutate({ agentId: agent.id, rating })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
