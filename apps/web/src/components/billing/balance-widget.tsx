"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Wallet, Loader2 } from "lucide-react";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

interface BalanceInfo {
  balanceSom: number;
  pricePerMessageSom: number;
  messagesRemaining: number;
}

/**
 * Balans widget — hamma joyda ko'rinadigan haqiqat: pulni foydalanuvchi
 * to'laydi, platforma emas. Balans tugasa, chat /billing/charge-message'da
 * 402 bilan to'xtaydi (backend'da) — bu shunchaki shu holatni ko'rsatadi.
 */
export function BalanceWidget() {
  const api = useApiClient();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("10000");

  const { data } = useQuery({
    queryKey: ["billing-me"],
    queryFn: () => api.get<BalanceInfo>("/billing/me"),
    refetchInterval: 30_000,
  });

  const topup = useMutation({
    mutationFn: (amountSom: number) => api.post<{ payUrl: string }>("/billing/topup", { amountSom }),
    onSuccess: (res) => {
      window.open(res.payUrl, "_blank");
      setOpen(false);
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: t("billing.error"), description: e.message });
    },
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Wallet className="h-3.5 w-3.5" />
        <span className="nums">{(data?.balanceSom ?? 0).toLocaleString()}</span>
        <span className="text-muted-foreground">so'm</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("billing.title")}</DialogTitle>
            <DialogDescription>{t("billing.subtitle")}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="rounded-xl border bg-muted/40 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("billing.currentBalance")}</span>
                <span className="nums font-semibold">{(data?.balanceSom ?? 0).toLocaleString()} so'm</span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{t("billing.pricePerMessage")}</span>
                <span className="nums">{data?.pricePerMessageSom ?? "—"} so'm</span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{t("billing.messagesLeft")}</span>
                <span className="nums">{data?.messagesRemaining ?? 0}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="topup-amount" className="text-sm font-medium">{t("billing.topupAmount")}</label>
              <Input
                id="topup-amount"
                type="number"
                min={1000}
                step={1000}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => topup.mutate(Number(amount))}
              disabled={topup.isPending || Number(amount) < 1000}
            >
              {topup.isPending ? <Loader2 className="animate-spin" /> : <Wallet />}
              {t("billing.payViaPayme")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
