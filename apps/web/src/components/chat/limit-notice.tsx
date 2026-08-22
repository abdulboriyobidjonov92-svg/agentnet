"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Clock, Wallet, Snowflake } from "lucide-react";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { openTopup, type BalanceInfo } from "@/components/billing/balance-widget";

/**
 * Chatdagi CHEGARA holatlari (UI-5).
 *
 * Nima uchun alohida komponent: ilgari `rate_limit` va `insufficient_balance`
 * oddiy matn pufagiga aylanardi (`⏳ ${message}`) — ya'ni foydalanuvchi
 * uchun bu "xato"dan farq qilmasdi va keyin nima qilishi noma'lum qolardi.
 *
 * PRICING_ARCHITECTURE §5 qoidalari bu yerda MAJBURIY:
 *   ❌ "Limitingiz tugadi. Pro oling."
 *   ✅ nima bo'ldi · qachon tiklanadi · keyingi qadam
 *   ❌ ishni to'xtatuvchi modal — bu kartochka oqim ICHIDA, chat ochiq qoladi
 *
 * Upgrade taklifi faqat QIYMAT ko'rsatilgan joyda: bu yerda foydalanuvchi
 * bugun allaqachon ishlatib bo'lgan — ya'ni qiymatni ko'rgan.
 */

export type LimitKind = "rate_limit" | "insufficient_balance" | "agent_frozen";

interface Props {
  kind: LimitKind;
  /** Backenddan kelgan xabar — bo'lsa, sarlavha ostida ko'rsatiladi. */
  message?: string;
  /** `rate_limit` sababi (`daily` | `global` | ...) — matnni aniqlashtiradi. */
  reason?: string;
}

export function LimitNotice({ kind, message, reason }: Props) {
  const { t } = useT();

  if (kind === "rate_limit") return <RateLimitCard message={message} reason={reason} />;
  if (kind === "insufficient_balance") return <BalanceCard message={message} />;

  return (
    <NoticeShell
      icon={<Snowflake className="h-4 w-4" />}
      tone="warn"
      title={t("limit.frozenTitle")}
      body={message ?? t("limit.frozenBody")}
      action={
        <Button size="sm" variant="outline" asChild>
          <Link href="/agents">{t("limit.frozenAction")}</Link>
        </Button>
      }
    />
  );
}

function RateLimitCard({ message, reason }: { message?: string; reason?: string }) {
  const api = useApiClient();
  const { t } = useT();

  // Kunlik limit — foydalanuvchi aynan nechtadan nechtasini ishlatganini
  // ko'rsatamiz. "Limitga yetdingiz" o'zi hech narsa aytmaydi.
  const { data: usage } = useQuery({
    queryKey: ["usage-me"],
    queryFn: () => api.get<any>("/usage/me"),
    staleTime: 30_000,
  });

  // Global cap — bu foydalanuvchining aybi EMAS va Pro uni yechmaydi.
  // Shuning uchun bu shoxda upgrade taklifi KO'RSATILMAYDI (§5: qiymat
  // ko'rsatilmagan joyda upgrade taklif qilinmaydi).
  const isGlobal = reason === "global";
  const used = usage?.chat?.used;
  const limit = usage?.chat?.limit;
  const isFree = usage?.plan === "free";

  return (
    <NoticeShell
      icon={<Clock className="h-4 w-4" />}
      tone="warn"
      title={
        isGlobal
          ? t("limit.globalTitle")
          : used != null && limit != null
            ? t("limit.dailyTitleN").replace("{used}", String(used)).replace("{limit}", String(limit))
            : t("limit.dailyTitle")
      }
      body={isGlobal ? t("limit.globalBody") : t("limit.dailyBody")}
      note={message}
      action={
        isGlobal || !isFree ? null : (
          <Button size="sm" variant="outline" asChild>
            <Link href="/pricing">{t("limit.seePro")}</Link>
          </Button>
        )
      }
    />
  );
}

function BalanceCard({ message }: { message?: string }) {
  const api = useApiClient();
  const { t } = useT();

  const { data } = useQuery({
    queryKey: ["billing-me"],
    queryFn: () => api.get<BalanceInfo>("/billing/me"),
    staleTime: 10_000,
  });

  // "Qancha yetishmayapti" — foydalanuvchi o'zi hisoblamasin.
  const balance = data?.balanceSom;
  const price = data?.pricePerMessageSom;
  const short = balance != null && price != null ? Math.max(0, price - balance) : null;

  return (
    <NoticeShell
      icon={<Wallet className="h-4 w-4" />}
      tone="danger"
      title={t("limit.balanceTitle")}
      body={
        short != null && price != null
          ? t("limit.balanceBodyN")
              .replace("{balance}", (balance ?? 0).toLocaleString())
              .replace("{price}", price.toLocaleString())
          : t("limit.balanceBody")
      }
      note={message}
      action={
        <Button size="sm" onClick={openTopup}>
          <Wallet /> {t("limit.topup")}
        </Button>
      }
    />
  );
}

function NoticeShell({
  icon,
  tone,
  title,
  body,
  note,
  action,
}: {
  icon: React.ReactNode;
  tone: "warn" | "danger";
  title: string;
  body: string;
  note?: string;
  action?: React.ReactNode;
}) {
  return (
    // Chat oqimi ichida, bot pufagi o'rnida — modal EMAS (§5: ishni
    // to'xtatuvchi oyna taqiqlanadi).
    <div className="flex gap-3">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-warn/10 text-warn"
        }`}
      >
        {icon}
      </div>
      <div className="max-w-[80%] rounded-2xl rounded-tl-none border bg-card px-4 py-3">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        {note && <p className="mt-1.5 text-xs text-muted-foreground/80">{note}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
