import { RiskTier } from '@prisma/client';

/**
 * V3-P0 · P0-6 — POLICY QARORINING KIRISHLARI (8 O'LCHOV).
 *
 * Blueprint: `docs/blueprints/P0_BLUEPRINT.md` P0-6 §5.
 * Spetsifikatsiya: `docs/strategy/SAFETY_POLICY_LAYER.md` §2.
 *
 * ⚠️ NEGA SAKKIZTA. Faqat `tool` nomiga qarab tier belgilash
 * `google-sheets.read` va `telegram-bot.send_message(500 ta qabul
 * qiluvchi)` orasidagi farqni **ko'rmaydi** — ikkisi ham "telegram tool"
 * yoki "sheets tool" bo'lib qoladi. Farq quyidagi o'lchamlarda yashaydi:
 * `action` (o'qish vs yuborish), `scope` (1 vs 500), `data` (shaxsiy
 * ma'lumot bormi), `context` (ishonchsiz kontent tegdimi).
 *
 * Shuning uchun qaror kirishi **to'liq kontekst** oladi, tool nomi emas.
 */
export interface PolicyInput {
  /** 1 — kim boshladi. `agent` o'zi boshlagan amal odam boshlaganidan xavfliroq. */
  actor: 'user' | 'agent' | 'admin' | 'system';
  /** 2 — qaysi agent (egasi, vertikali). */
  agent: { id: string; vertical?: string | null; killedAt?: Date | null };
  /** 3 — qaysi tool/konnektor. */
  tool: { connectorId: string; actionId: string };
  /**
   * 4 — NIMAGA ta'sir qiladi. ⚠️ Yagona eng muhim o'lcham.
   * `self` — foydalanuvchining o'z resursi; `external` — tashqi tomon.
   */
  target: { kind: 'self' | 'internal' | 'external'; identifiers?: string[] };
  /** 5 — qanday ma'lumot ishlatiladi. */
  data: { containsPersonal: boolean; fromUntrustedSource: boolean };
  /** 6 — amal turi. */
  action: 'read' | 'write' | 'send' | 'delete' | 'pay' | 'submit';
  /** 7 — ijro konteksti (injection zanjiri belgilari). */
  context: { stepIndex: number; untrustedContentSeen: boolean; spentTiyin?: number };
  /** 8 — blast radius (nechta qabul qiluvchi / nechta yozuv). */
  scope: { size: number };
}

export interface PolicyDecision {
  tier: RiskTier;
  /** Amal bajarilishi mumkinmi (tasdiqdan keyin ham). */
  allow: boolean;
  /** Inson tasdig'i talab qilinadimi. */
  requiresApproval: boolean;
  /** Nega shunday qaror — foydalanuvchiga va trace'ga ko'rsatiladi. */
  reasons: string[];
  /** Qaysi qoidalar qo'llandi (audit uchun). */
  appliedRules: string[];
}

/** Tierlarni solishtirish uchun tartib (faqat KO'TARISH uchun ishlatiladi). */
export const TIER_ORDER: Record<RiskTier, number> = {
  [RiskTier.LOW]: 0,
  [RiskTier.MEDIUM]: 1,
  [RiskTier.HIGH]: 2,
  [RiskTier.CRITICAL]: 3,
};

/** Ikki tierdan YUQORISINI qaytaradi — pasaytirish hech qachon bo'lmaydi. */
export function maxTier(a: RiskTier, b: RiskTier): RiskTier {
  return TIER_ORDER[a] >= TIER_ORDER[b] ? a : b;
}
