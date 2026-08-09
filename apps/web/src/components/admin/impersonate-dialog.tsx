"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Eye, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/toast";
import { useApiClient, apiErrorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import type { ImpersonationMeta } from "@/lib/session";

/**
 * SEC-12 §18 — impersonation boshlash dialogi.
 *
 * Boshlashdan OLDIN ko'rsatiladi (Contract talabi): nishon, operatorning
 * o'zi, sabab maydoni, READ-ONLY rejim, 30 daqiqalik chegara va taqiqlar
 * ro'yxati.
 *
 * UI XAVFSIZLIK CHORASI EMAS: sabab uzunligi, TOTP, rol matritsasi,
 * muddat — hammasi serverda qayta tekshiriladi. Bu yerdagi `disabled`
 * faqat operatorni xato yo'ldan qaytaradi.
 */

const MIN_REASON = 20;

interface StartResponse {
  impersonationId: string;
  token: string;
  mode: "READ_ONLY";
  expiresAt: string;
  target: { id: string; email: string; name: string | null };
}

interface Props {
  target: { id: string; email: string; name?: string | null };
  actorEmail: string;
  onClose: () => void;
}

export function ImpersonateDialog({ target, actorEmail, onClose }: Props) {
  const { t } = useT();
  const api = useApiClient();

  const [reason, setReason] = useState("");
  const [totp, setTotp] = useState("");

  const run = useMutation({
    mutationFn: async () => {
      const started = await api.post<StartResponse>("/admin/impersonation", {
        targetUserId: target.id,
        reason: reason.trim(),
        totp,
      });

      // Token brauzer JS'ida SAQLANMAYDI — darhol server-route'ga beriladi
      // va u httpOnly cookie'ga yozadi (login oqimi bilan bir xil naqsh).
      const meta: ImpersonationMeta = {
        impersonationId: started.impersonationId,
        targetEmail: started.target.email,
        targetName: started.target.name,
        expiresAt: started.expiresAt,
        mode: started.mode,
      };
      const res = await fetch("/api/impersonation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: started.token, meta }),
      });
      if (!res.ok) throw new Error(t("imp.cookieFailed"));
      return started;
    },
    onSuccess: () => {
      // To'liq navigatsiya: middleware yangi cookie'ni ko'rishi va butun
      // RSC daraxti nishon kontekstida qayta qurilishi shart.
      window.location.href = "/dashboard";
    },
    onError: (e) => {
      toast({ variant: "destructive", title: t("common.error"), description: apiErrorMessage(e, t) });
    },
  });

  const reasonOk = reason.trim().length >= MIN_REASON;
  const totpOk = /^\d{6}$/.test(totp);
  const ready = reasonOk && totpOk && !run.isPending;

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 shrink-0 text-warn" />
            {t("imp.startTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <div className="flex gap-2 rounded-xl border border-warn/30 bg-warn/10 p-3 text-warn">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-xs leading-relaxed">{t("imp.startWarning")}</p>
              </div>

              <dl className="space-y-1 rounded-xl border bg-surface-2/50 p-3 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t("imp.target")}</dt>
                  <dd className="truncate font-medium">{target.email}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t("imp.actor")}</dt>
                  <dd className="truncate font-medium">{actorEmail}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t("imp.mode")}</dt>
                  <dd className="font-medium">{t("imp.readOnly")}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t("imp.maxDuration")}</dt>
                  <dd className="font-medium">30:00</dd>
                </div>
              </dl>

              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("imp.restrictions")}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium">{t("imp.reason")}</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full rounded-xl border bg-card px-3 py-2 text-sm outline-none transition focus-visible:ring-1 focus-visible:ring-vein-cyan"
            />
            <span className={reasonOk ? "text-xs text-ok" : "text-xs text-muted-foreground"}>
              {reason.trim().length}/{MIN_REASON}
            </span>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium">{t("admin.dangerTotp")}</span>
            <Input
              value={totp}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              aria-label={t("admin.dangerTotp")}
            />
          </label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={run.isPending}>{t("common.cancel")}</AlertDialogCancel>
          <Button disabled={!ready} onClick={() => run.mutate()}>
            {run.isPending && <Loader2 className="animate-spin" />}
            {t("imp.startAction")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
