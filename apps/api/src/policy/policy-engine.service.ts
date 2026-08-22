import { Injectable, Logger } from '@nestjs/common';
import { RiskTier } from '@prisma/client';
import { connectorById } from '../connectors/connectors.registry';
import { maxTier, type PolicyDecision, type PolicyInput } from './policy.types';

/**
 * V3-P0 · P0-6 — POLICY ENGINE.
 *
 * Spetsifikatsiya: `docs/strategy/SAFETY_POLICY_LAYER.md` §2.
 * Blueprint: P0-6.
 *
 * QOIDALAR KODDA, DB'DA EMAS: P0 da o'zgaruvchan qoida tahriri uchun
 * foydalanish nuqtasi yo'q (Konstitutsiya #38). Qoidalar deklarativ
 * jadval sifatida shu faylda — o'qish oson, testlash oson.
 *
 * ⚠️ CASL/OPA EMAS (Contract A8/ADR-002 ularni rad etgan). Bu — **risk
 * tier** engine, RBAC emas: savol "bu amal qanchalik xavfli?", "bu
 * foydalanuvchi kim?" emas. RBAC allaqachon `RolesGuard` da.
 *
 * ⚠️ FAIL-CLOSED: `evaluate()` hech qachon throw qilmaydi, lekin ichida
 * kutilmagan holat bo'lsa `allow: false` qaytaradi. "Qaror qabul qila
 * olmadim" = "ruxsat yo'q", "ruxsat bor" EMAS.
 */
@Injectable()
export class PolicyEngine {
  private readonly logger = new Logger(PolicyEngine.name);

  /**
   * Amalni baholaydi.
   *
   * Tier hisoblash tartibi — har qadam faqat KO'TARADI (§2.1.3: pasaytirish
   * ADR talab qiladi, ya'ni runtime'da mumkin emas):
   *   1. Konnektor minimal tieri (§3.2 jadvali)
   *   2. Amal turi (`send`/`pay`/`submit`/`delete` — ko'taradi)
   *   3. Qaytarilmaslik (`reversible: false` → CRITICAL)
   *   4. Blast radius (ko'p qabul qiluvchi → ko'taradi)
   *   5. "Lethal trifecta" (shaxsiy data + ishonchsiz kontent + tashqi yuborish)
   *   6. Noma'lum tool → default HIGH (§2.1.1)
   */
  evaluate(input: PolicyInput): PolicyDecision {
    try {
      return this.evaluateInner(input);
    } catch (e: any) {
      // Fail-closed. Bu — dasturchi xatosi, lekin u ruxsatga aylanmaydi.
      this.logger.error(`Policy qarori yiqildi — amal BLOKLANADI: ${e?.message}`);
      return {
        tier: RiskTier.CRITICAL,
        allow: false,
        requiresApproval: false,
        reasons: ['policy_evaluation_failed'],
        appliedRules: ['fail-closed'],
      };
    }
  }

  private evaluateInner(input: PolicyInput): PolicyDecision {
    const reasons: string[] = [];
    const appliedRules: string[] = [];

    // --- 0) Kill switch: hamma narsadan OLDIN (§4) ---
    if (input.agent.killedAt) {
      return {
        tier: RiskTier.CRITICAL,
        allow: false,
        requiresApproval: false,
        reasons: ['agent_killed'],
        appliedRules: ['kill-switch'],
      };
    }

    const def = connectorById.get(input.tool.connectorId);

    // --- 1) Konnektor minimal tieri ---
    // §2.1.1: "Tier belgilanmagan yangi amal avtomatik HIGH bo'ladi."
    let tier: RiskTier = RiskTier.HIGH;
    if (!def) {
      reasons.push('unknown_connector_default_high');
      appliedRules.push('default-high');
    } else {
      tier = RiskTier[def.limits.riskTier];
      appliedRules.push(`connector-tier:${def.limits.riskTier}`);

      // --- 3) Qaytarilmaslik (§5: "undo yozilmagan amal CRITICAL") ---
      // Faqat yon-ta'sirli amallarda: `google-sheets` reversible=true bo'lsa
      // ham `read` amalini ko'tarish ma'nosiz.
      if (!def.limits.reversible && isSideEffecting(input.action)) {
        tier = maxTier(tier, RiskTier.CRITICAL);
        reasons.push('irreversible_action');
        appliedRules.push('irreversible->critical');
      }
    }

    // --- 2) Amal turi ---
    const byAction = ACTION_TIER[input.action];
    if (byAction) {
      const before = tier;
      tier = maxTier(tier, byAction);
      appliedRules.push(`action:${input.action}->${byAction}`);
      if (tier !== before) reasons.push(`action_${input.action}`);
    }

    // O'qish amali — tashqi ta'sir yo'q, shuning uchun konnektor tieri
    // qanday bo'lishidan qat'i nazar LOW ga TUSHIRILADI... EMAS.
    // ⚠️ Ataylab tushirilmaydi: `soliq-uz.read` foydalanuvchining soliq
    // ma'lumotini o'qiydi — bu shaxsiy ma'lumot va uni tashqariga chiqarish
    // yo'li bor. Pasaytirish ADR talab qiladi (§2.1.3).

    // --- 4) Blast radius ---
    if (input.scope.size >= BLAST_RADIUS_CRITICAL) {
      tier = maxTier(tier, RiskTier.CRITICAL);
      reasons.push('blast_radius_large');
      appliedRules.push(`scope:${input.scope.size}->CRITICAL`);
    } else if (input.scope.size >= BLAST_RADIUS_HIGH) {
      tier = maxTier(tier, RiskTier.HIGH);
      reasons.push('blast_radius_multiple');
      appliedRules.push(`scope:${input.scope.size}->HIGH`);
    }

    // --- 5) "Lethal trifecta" (§1) ---
    // Shaxsiy data + ishonchsiz kontent + tashqi yuborish BIR sessiyada.
    const trifecta =
      input.data.containsPersonal &&
      (input.data.fromUntrustedSource || input.context.untrustedContentSeen) &&
      input.target.kind === 'external' &&
      isSideEffecting(input.action);
    if (trifecta) {
      tier = maxTier(tier, RiskTier.CRITICAL);
      reasons.push('lethal_trifecta');
      appliedRules.push('trifecta->CRITICAL');
    }

    // --- Tashqi tomonga ta'sir — hech qachon LOW emas ---
    if (input.target.kind === 'external' && isSideEffecting(input.action)) {
      tier = maxTier(tier, RiskTier.HIGH);
      appliedRules.push('external-side-effect->HIGH');
    }

    // --- Yakuniy qaror ---
    //
    // P0 da MAJBURLANADIGAN ikki tier (§2.2): `LOW` avtomatik, qolganlari
    // tasdiq talab qiladi. `MEDIUM`/`CRITICAL` yoziladi va ko'rinadi, lekin
    // ularning alohida oqimi (dual approval) V3-P2 da.
    const requiresApproval = tier !== RiskTier.LOW;

    return {
      tier,
      allow: true,
      requiresApproval,
      reasons,
      appliedRules,
    };
  }
}

/** Yon ta'sirli amal — tashqi/ichki holatni O'ZGARTIRADI. */
function isSideEffecting(action: PolicyInput['action']): boolean {
  return action !== 'read';
}

/** Amal turi bo'yicha minimal tier. `read` — ko'tarmaydi. */
const ACTION_TIER: Partial<Record<PolicyInput['action'], RiskTier>> = {
  write: RiskTier.MEDIUM,
  send: RiskTier.HIGH,
  submit: RiskTier.CRITICAL,
  pay: RiskTier.CRITICAL,
  delete: RiskTier.CRITICAL,
};

/**
 * Blast radius chegaralari `[CALIBRATE]` — real foydalanish o'lchangach
 * qayta ko'riladi. Hozirgi mantiq: bittadan ko'p tashqi qabul qiluvchi
 * allaqachon "ommaviy yuborish" ga qadam.
 */
const BLAST_RADIUS_HIGH = 2;
const BLAST_RADIUS_CRITICAL = 50;
