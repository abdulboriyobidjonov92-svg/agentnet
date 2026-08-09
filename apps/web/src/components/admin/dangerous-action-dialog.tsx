"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
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

/**
 * SEC-11 §6.5 — xavfli amal tasdiqlash oqimi (minimal, ishlab-chiqarish sifati).
 *
 * UI xavfsizlik CHORASI EMAS — har bir tekshiruv serverda takrorlanadi
 * (sabab uzunligi, TOTP, tasdiqlash satri, rol, holat mashinasi). Bu yerdagi
 * `disabled`/`minLength` faqat foydalanuvchini xato yo'ldan qaytarish uchun.
 *
 * Oqim ikki bosqichli (server modeli bilan bir xil):
 *   1. so'rov  -> `pending` amal yaratiladi (sabab + TOTP + tasdiq satri)
 *   2. bajarish -> TOTP qayta so'raladi va amal ijro etiladi
 * Foydalanuvchi 1-bosqichdan keyin to'xtasa, amal bekor qilinadi.
 */

export type DangerousKind =
  | "role_assign"
  | "session_revoke"
  // SEC-12 — Users yozish amallari. ATAYLAB SHU dialogga qo'shildi:
  // ikkinchi tasdiqlash oqimi yaratilmaydi (server tomonda ham bitta
  // framework).
  | "credit_manual"
  | "user_block"
  | "user_unblock";

const VERB: Record<DangerousKind, string> = {
  role_assign: "ROLE",
  session_revoke: "REVOKE",
  credit_manual: "CREDIT",
  user_block: "BLOCK",
  user_unblock: "UNBLOCK",
};

const TITLE_KEY: Record<DangerousKind, string> = {
  role_assign: "admin.dangerRoleTitle",
  session_revoke: "admin.dangerRevokeTitle",
  credit_manual: "admin.dangerCreditTitle",
  user_block: "admin.dangerBlockTitle",
  user_unblock: "admin.dangerUnblockTitle",
};

interface Props {
  kind: DangerousKind;
  target: { id: string; email: string };
  /** `role_assign` uchun tanlangan yangi rol. */
  newRole?: string;
  onClose: () => void;
}

const MIN_REASON = 20;
/** So'mdan tiyinga — API pulni TIYINDA va SATR sifatida kutadi (A13). */
const TIYIN_PER_SOM = 100n;

export function DangerousActionDialog({ kind, target, newRole, onClose }: Props) {
  const { t } = useT();
  const api = useApiClient();
  const qc = useQueryClient();

  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [totp, setTotp] = useState("");
  /** Faqat `credit_manual` uchun — SO'MDA kiritiladi. */
  const [amountSom, setAmountSom] = useState("");

  const expected = `${VERB[kind]} ${target.id}`;
  const needsAmount = kind === "credit_manual";
  const amountTiyin =
    needsAmount && /^[1-9][0-9]{0,12}$/.test(amountSom)
      ? (BigInt(amountSom) * TIYIN_PER_SOM).toString()
      : null;

  const run = useMutation({
    mutationFn: async () => {
      // 1-bosqich — tasdiqlangan `pending` amal
      const action = await api.post<{ id: string }>("/admin/dangerous-actions", {
        kind,
        targetUserId: target.id,
        reason: reason.trim(),
        totp,
        confirmation: confirmation.trim(),
        ...(newRole ? { newRole } : {}),
        ...(amountTiyin ? { amountTiyin } : {}),
      });
      // 2-bosqich — bajarish (TOTP qayta yuboriladi)
      return api.post(`/admin/dangerous-actions/${action.id}/execute`, { totp });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({ title: t("admin.dangerDone") });
      onClose();
    },
    onError: (e) => {
      toast({ variant: "destructive", title: t("common.error"), description: apiErrorMessage(e, t) });
    },
  });

  const reasonOk = reason.trim().length >= MIN_REASON;
  const confirmOk = confirmation.trim() === expected;
  const totpOk = /^\d{6}$/.test(totp);
  const amountOk = !needsAmount || amountTiyin !== null;
  const ready = reasonOk && confirmOk && totpOk && amountOk && !run.isPending;

  const title = t(TITLE_KEY[kind]);

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 shrink-0 text-danger" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              {/* Qaytarib bo'lmasligi — birinchi navbatda ko'rinadi */}
              <div className="flex gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-danger">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-xs leading-relaxed">{t("admin.dangerWarning")}</p>
              </div>

              <dl className="space-y-1 rounded-xl border bg-surface-2/50 p-3 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t("admin.dangerTarget")}</dt>
                  <dd className="truncate font-medium">{target.email}</dd>
                </div>
                {newRole && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{t("admin.colRole")}</dt>
                    <dd className="font-medium">{newRole}</dd>
                  </div>
                )}
              </dl>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          {needsAmount && (
            <label className="block space-y-1">
              <span className="text-xs font-medium">{t("admin.dangerAmount")}</span>
              <Input
                value={amountSom}
                onChange={(e) => setAmountSom(e.target.value.replace(/\D/g, "").slice(0, 13))}
                inputMode="numeric"
                placeholder="100000"
                aria-label={t("admin.dangerAmount")}
              />
              <span className="text-xs text-muted-foreground">{t("admin.dangerAmountHint")}</span>
            </label>
          )}

          <label className="block space-y-1">
            <span className="text-xs font-medium">{t("admin.dangerReason")}</span>
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
            <span className="text-xs font-medium">{t("admin.dangerConfirm")}</span>
            <code className="block truncate rounded-lg bg-muted px-2 py-1 text-[11px]">{expected}</code>
            <Input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              aria-label={t("admin.dangerConfirm")}
            />
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
          <Button variant="destructive" disabled={!ready} onClick={() => run.mutate()}>
            {run.isPending && <Loader2 className="animate-spin" />}
            {t("admin.dangerExecute")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
