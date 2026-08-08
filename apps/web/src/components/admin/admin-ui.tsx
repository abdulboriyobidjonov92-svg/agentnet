"use client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

/**
 * Phase 4 — admin ekranlari uchun kichik umumiy qismlar.
 * Har ekranda takrorlanmasligi uchun bitta joyda.
 */

/** Ro'yxat sarlavhasi + topilgan natijalar soni. */
export function AdminPageHeader({
  title,
  subtitle,
  total,
}: {
  title: string;
  subtitle: string;
  total?: number;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {total !== undefined && (
        <span className="nums text-sm tabular-nums text-muted-foreground">
          {total.toLocaleString()}
        </span>
      )}
    </div>
  );
}

/** Rol nishoni — imtiyozli rollar vizual ajratiladi (§6.1 ierarxiyasi). */
export function RoleBadge({ role }: { role: string }) {
  const variant =
    role === "OWNER" ? "danger" : role === "ADMIN" ? "warn" : role === "SUPPORT" ? "primary" : "outline";
  return <Badge variant={variant}>{role}</Badge>;
}

/** Qidiruv maydonini kechiktiradi — har harfda so'rov yuborilmaydi. */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
