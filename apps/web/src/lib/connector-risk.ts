import type { RiskTier } from "@/components/ui/status";

/**
 * Konnektor → minimal risk tier (UI-3).
 *
 * ⚠️ VAQTINCHA KLIENT TOMONDA. Yagona haqiqat manbai bo'lishi kerak
 * bo'lgan joy — backend `connector.types.ts` dagi `riskTier` maydoni
 * (P0-6 policy engine bilan keladi). U yozilgach bu fayl O'CHIRILADI va
 * tier `/connectors/mine` javobidan olinadi.
 *
 * Nega hozir baribir kerak: foydalanuvchi konnektorni agentga
 * biriktirayotganda "bu agent endi SMS yubora oladi" degan ma'noni
 * KO'RISHI kerak. Buni P0-6 gacha kechiktirish — biriktirish oqimini
 * risk ko'rsatkichisiz ochib qo'yish demak.
 *
 * Qiymatlar O'YLAB TOPILMAGAN — ular
 * `docs/strategy/SAFETY_POLICY_LAYER.md` §3.2 jadvalidan bir-bir
 * ko'chirilgan. Bu faylni o'zgartirishdan oldin o'sha jadval o'zgarishi shart.
 */

/** SAFETY_POLICY_LAYER §3.2 — konnektor turi bo'yicha minimal tier. */
const BY_CATEGORY: Record<string, RiskTier> = {
  payments: "critical", // qaytarilmas pul harakati
  government: "critical", // huquqiy oqibat
  accounting: "critical", // Didox e-invoice — davlat hujjati oqimi
  messaging: "high", // tashqi dunyoga xabar (SMS/Telegram/email)
  crm: "high", // biznes ma'lumotini o'zgartiradi
  ecommerce: "high", // ayni sabab
  logistics: "low", // o'qish-only (yetkazib berish holati)
  data: "low", // Google Sheets o'qish
};

/**
 * Kategoriya jadvali bermaydigan aniqliklar. Bu yerda faqat kategoriyadan
 * FARQ qiladigan konnektorlar bo'ladi — takrorlash qo'shilmaydi.
 */
const BY_ID: Partial<Record<string, RiskTier>> = {
  // SMS — `messaging` ichida, lekin pul + reklama/spam javobgarligi bor.
  // §3.2 ularni alohida qatorda `HIGH` deb sanaydi; kategoriya bilan bir xil,
  // shuning uchun bu yerda faqat NIYAT qayd etilgan (kelajakda ko'tarilsa).
  "eskiz-sms": "high",
  "playmobile-sms": "high",
};

/**
 * Tier belgilanmagan konnektor — `high`.
 * SAFETY_POLICY_LAYER §2.1.1: "Default = HIGH. Tier belgilanmagan yangi amal
 * avtomatik HIGH bo'ladi." Noma'lum narsa xavfsiz deb taxmin qilinmaydi.
 */
export const DEFAULT_TIER: RiskTier = "high";

export function connectorRiskTier(connector: {
  id?: string;
  category?: string;
  /** Backend tier bergan bo'lsa (P0-6 dan keyin) — U USTUN. */
  riskTier?: string;
}): RiskTier {
  const fromBackend = connector.riskTier;
  if (fromBackend === "low" || fromBackend === "medium" || fromBackend === "high" || fromBackend === "critical") {
    return fromBackend;
  }
  return (
    (connector.id ? BY_ID[connector.id] : undefined) ??
    (connector.category ? BY_CATEGORY[connector.category] : undefined) ??
    DEFAULT_TIER
  );
}
