"use client";
import { Users, Bot, CheckCircle2, Package, FolderTree, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { StatTile, AreaChart, BarList } from "@/components/charts/charts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";

interface DayPoint {
  day: string;
  value: number;
}

interface AdminOverview {
  totals: {
    users: number;
    agents: number;
    publishedAgents: number;
    conversations: number;
    products: number;
    categories: number;
    revenueTiyin: number;
  };
  usersByDay: DayPoint[];
  revenueByDay: DayPoint[];
  topAgents: { id: string; name: string; installCount: number; usageCount: number; ratingAvg: number | null }[];
  agentsByCategory: { category: string; count: number }[];
  productsByCategory: { category: string; count: number }[];
}

export default function AdminDashboardPage() {
  const api = useApiClient();
  const { t } = useT();

  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get<AdminOverview>("/admin/stats/overview"),
  });

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  const { totals } = data;
  const som = (tiyin: number) => Math.round(tiyin / 100).toLocaleString("ru-RU");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatTile label={t("admin.stat.users")} value={totals.users.toLocaleString()} accent="cyan" icon={<Users className="h-4 w-4" />} />
        <StatTile label={t("admin.stat.agents")} value={totals.agents.toLocaleString()} accent="violet" icon={<Bot className="h-4 w-4" />} />
        <StatTile label={t("admin.stat.publishedAgents")} value={totals.publishedAgents.toLocaleString()} accent="emerald" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatTile label={t("admin.stat.products")} value={totals.products.toLocaleString()} accent="blue" icon={<Package className="h-4 w-4" />} />
        <StatTile label={t("admin.stat.categories")} value={totals.categories.toLocaleString()} accent="gold" icon={<FolderTree className="h-4 w-4" />} />
        <StatTile label={t("admin.stat.revenue")} value={som(totals.revenueTiyin)} accent="rose" icon={<Wallet className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("admin.chart.newUsers")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AreaChart data={data.usersByDay.map((d) => d.value)} accent="cyan" height={160} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("admin.chart.revenue")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AreaChart data={data.revenueByDay.map((d) => Math.round(d.value / 100))} accent="emerald" height={160} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("admin.chart.topAgents")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topAgents.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("admin.chart.empty")}</p>
            ) : (
              <BarList
                accent="violet"
                items={data.topAgents.map((a) => ({ label: a.name, value: a.installCount }))}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("admin.chart.agentsByCategory")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.agentsByCategory.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("admin.chart.empty")}</p>
            ) : (
              <BarList accent="cyan" items={data.agentsByCategory.map((c) => ({ label: c.category, value: c.count }))} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("admin.chart.productsByCategory")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.productsByCategory.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("admin.chart.empty")}</p>
            ) : (
              <BarList accent="gold" items={data.productsByCategory.map((c) => ({ label: c.category, value: c.count }))} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
