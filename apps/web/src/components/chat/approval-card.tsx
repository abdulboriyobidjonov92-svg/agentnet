"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, ShieldAlert, X } from "lucide-react";
import { useApiClient } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { RiskBadge, type RiskTier } from "@/components/ui/status";
import { toast } from "@/components/ui/toast";

/**
 * UI-4 — INSON TASDIG'I KARTASI (SAFETY_POLICY_LAYER §8).
 *
 * Uchta amal, va uchinchisi ENG MUHIMI:
 *   Tasdiqlash  — agent taklifi to'g'ri
 *   Rad etish   — bu amal umuman qilinmasin
 *   TAHRIRLASH  — amal to'g'ri, lekin TAFSILOTI xato ⭐
 *
 * Uchinchisi `ApprovalEvent.modifiedAction` ga yoziladi va aynan u
 * agentni yaxshilash uchun eng qimmatli signal (MASTER_ROADMAP §2 M3).
 * Uni "rad etish" ga qo'shib yuborish moatni yo'q qiladi — shuning uchun
 * bu yerda alohida tugma.
 *
 * ⚠️ NIMA YUBORILISHI TO'LIQ KO'RSATILADI. Foydalanuvchi "ha" bosishdan
 * oldin AYNAN nima bo'lishini ko'rishi shart — aks holda tasdiq ko'r-ko'rona
 * bo'ladi va butun HITL qatlami bezakka aylanadi (§2.1 T2 qoldiq xavfi).
 */

export interface ApprovalPayload {
  approvalId?: string;
  riskTier?: string;
  proposedAction?: unknown;
}

function asPayload(raw: unknown): ApprovalPayload {
  return typeof raw === "object" && raw !== null ? (raw as ApprovalPayload) : {};
}

function normalizeTier(tier: unknown): RiskTier {
  const t = String(tier ?? "").toLowerCase();
  return t === "low" || t === "medium" || t === "high" || t === "critical" ? t : "high";
}

export function ApprovalCard({ payload }: { payload: unknown }) {
  const { t } = useT();
  const api = useApiClient();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [settled, setSettled] = useState<"APPROVED" | "REJECTED" | "MODIFIED" | null>(null);

  const { approvalId, riskTier, proposedAction } = asPayload(payload);
  const tier = normalizeTier(riskTier);
  const proposedText = JSON.stringify(proposedAction ?? {}, null, 2);

  const decide = useMutation({
    mutationFn: (body: { decision: string; modifiedAction?: unknown }) =>
      api.post(`/approvals/${approvalId}/decide`, body),
    onSuccess: (_res, body) => {
      setSettled(body.decision as typeof settled);
      qc.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: t("approval.failed"), description: e.message }),
  });

  // Tasdiq so'rovi identifikatorsiz kelsa — tugmalar ko'rsatilmaydi.
  // Bosib bo'lmaydigan tugma ko'rsatishdan ko'ra holatni ochiq aytamiz.
  if (!approvalId) {
    return (
      <Shell tier={tier} proposedText={proposedText} t={t}>
        <p className="text-xs text-muted-foreground">{t("approval.unavailable")}</p>
      </Shell>
    );
  }

  if (settled) {
    return (
      <Shell tier={tier} proposedText={proposedText} t={t}>
        <p className="text-xs font-medium">{t(`approval.settled.${settled}`)}</p>
      </Shell>
    );
  }

  const submitEdit = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      // Xato matni maydon yonida — modal yoki toast emas (UI-1 qoidasi).
      setDraftError(t("approval.invalidJson"));
      return;
    }
    setDraftError(null);
    decide.mutate({ decision: "MODIFIED", modifiedAction: parsed });
  };

  return (
    <Shell tier={tier} proposedText={editing ? null : proposedText} t={t}>
      {editing ? (
        <div className="space-y-2">
          <label htmlFor={`edit-${approvalId}`} className="block text-xs font-medium">
            {t("approval.editLabel")}
          </label>
          <Textarea
            id={`edit-${approvalId}`}
            rows={8}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            error={draftError ?? false}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={submitEdit} loading={decide.isPending}>
              <Check /> {t("approval.saveAndApprove")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraftError(null); }}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => decide.mutate({ decision: "APPROVED" })}
            loading={decide.isPending && decide.variables?.decision === "APPROVED"}
          >
            <Check /> {t("approval.approve")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setDraft(proposedText); setEditing(true); }}
          >
            <Pencil /> {t("approval.modify")}
          </Button>
          <Button
            size="sm"
            variant="destructive-ghost"
            onClick={() => decide.mutate({ decision: "REJECTED" })}
            loading={decide.isPending && decide.variables?.decision === "REJECTED"}
          >
            <X /> {t("approval.reject")}
          </Button>
        </div>
      )}
    </Shell>
  );
}

function Shell({
  tier,
  proposedText,
  t,
  children,
}: {
  tier: RiskTier;
  proposedText: string | null;
  t: (k: string) => string;
  children: React.ReactNode;
}) {
  return (
    <div data-risk={tier} className="risk-edge rounded-xl border p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="text-sm font-semibold">{t("approval.title")}</span>
        <RiskBadge tier={tier} label={t(`risk.${tier}`)} />
      </div>
      <p className="mb-2 text-xs text-muted-foreground">{t("approval.desc")}</p>
      {proposedText && (
        // AYNAN nima yuboriladi — yashirilmaydi, qisqartirilmaydi.
        <pre className="mb-3 max-h-48 overflow-auto rounded-lg bg-muted p-2 font-mono text-[11px] leading-relaxed">
          {proposedText}
        </pre>
      )}
      {children}
    </div>
  );
}
