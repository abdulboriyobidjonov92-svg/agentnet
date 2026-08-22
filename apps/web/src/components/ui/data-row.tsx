import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Zich ro'yxat qatori (UI-1).
 *
 * P0 da to'rt joyda BIR XIL naqsh kerak bo'ladi: ijrolar ro'yxati (UI-4),
 * konnektorlar (UI-3), admin ro'yxatlari (UI-7/UI-8) va approval navbati.
 * Ularning har biri `<table>` yozsa — to'rt xil zichlik, to'rt xil hover
 * va to'rtta boshqacha mobil xulq chiqadi.
 *
 * ATAYLAB `<table>` EMAS: bu qatorlar mobil (375px) da ustunlarga
 * bo'linadi, jadval esa gorizontal siljishga majbur qilardi (UI-9).
 * Semantik ro'yxat kerak bo'lsa `role="row"` bilan ishlatiladi.
 */

const DataList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      // `divide-*` qatorlar orasiga ingichka chiziq qo'yadi — har qatorga
      // border yozilsa oxirgisida ortiqcha chiziq qolardi.
      className={cn("divide-y divide-border overflow-hidden rounded-2xl border bg-card", className)}
      {...props}
    />
  ),
);
DataList.displayName = "DataList";

export interface DataRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Chapdagi belgi — `StatusDot`, ikonka yoki avatar. */
  leading?: React.ReactNode;
  /** O'ngdagi metama'lumot — vaqt, narx, `RiskBadge`. */
  trailing?: React.ReactNode;
  /** Ikkinchi qator — tavsif yoki natija xulosasi. */
  description?: React.ReactNode;
  /** Bosiladigan qator (klaviatura bilan ham). */
  onSelect?: () => void;
  selected?: boolean;
}

const DataRow = React.forwardRef<HTMLDivElement, DataRowProps>(
  ({ className, leading, trailing, description, onSelect, selected, children, ...props }, ref) => {
    const interactive = Boolean(onSelect);
    return (
      <div
        ref={ref}
        // Bosiladigan qator klaviatura bilan ham ishlashi SHART (UI-10).
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={onSelect}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.();
                }
              }
            : undefined
        }
        aria-current={selected || undefined}
        className={cn(
          "flex items-center gap-3 px-4 py-3 text-sm transition",
          interactive && "cursor-pointer hover:bg-muted",
          selected && "bg-muted",
          className,
        )}
        {...props}
      >
        {leading && <span className="flex shrink-0 items-center">{leading}</span>}
        <span className="min-w-0 flex-1">
          {/* `truncate` MUHIM: uzun agent nomi qatorni cho'zib, o'ngdagi
              metama'lumotni ekrandan chiqarib yuborardi (UI-9). */}
          <span className="block truncate font-medium">{children}</span>
          {description && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span>
          )}
        </span>
        {trailing && (
          <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            {trailing}
          </span>
        )}
      </div>
    );
  },
);
DataRow.displayName = "DataRow";

export { DataList, DataRow };
