"use client";
import type { ReactNode } from "react";
import { Loader2, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { useT } from "@/lib/i18n/client";

/**
 * Phase 4 §6.2 — admin jadvali.
 *
 * Barcha admin ro'yxatlari SHU komponentdan foydalanadi: yuklanish/bo'sh/
 * xato holatlari va "yana yuklash" mantig'i bir joyda (Contract: takroriy
 * mantiq taqiqlanadi). Kursorli pagination shartnomasi bilan ishlaydi —
 * `hasMore` bo'lgandagina tugma ko'rinadi.
 *
 * Ustun ta'rifi generik: har ekran o'z qator tipini beradi, `cell` esa
 * to'liq tiplangan qoladi (`any` yo'q).
 */
export interface Column<T> {
  /** Ustun kaliti — `key` sifatida ham ishlatiladi. */
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** O'ngga tekislash (raqamlar/summalar uchun). */
  align?: "right";
  /** Tor ekranda yashiriladigan ikkilamchi ustun. */
  secondary?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  /** Bo'sh holat matni — har ekran o'z kontekstini beradi. */
  emptyText: string;
  /** Qator bosilganda (ixtiyoriy) — detal ekraniga o'tish. */
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  isError,
  onRetry,
  hasMore,
  isLoadingMore,
  onLoadMore,
  emptyText,
  onRowClick,
}: DataTableProps<T>) {
  const { t } = useT();

  if (isError) return <ErrorState onRetry={onRetry} />;

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-live="polite">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border bg-card px-6 py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <Inbox className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-surface-2/50">
              {columns.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground",
                    c.align === "right" && "text-right",
                    c.secondary && "hidden lg:table-cell",
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                // Qator bosiladigan bo'lsa u klaviaturadan ham ochilishi shart.
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? "button" : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                className={cn(
                  "border-b border-border/50 transition last:border-0",
                  onRowClick &&
                    "cursor-pointer hover:bg-muted/50 focus:bg-muted/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-vein-cyan",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.id}
                    className={cn(
                      "px-4 py-3 align-middle",
                      c.align === "right" && "text-right",
                      c.secondary && "hidden lg:table-cell",
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && onLoadMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore && <Loader2 className="animate-spin" />}
            {t("common.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
