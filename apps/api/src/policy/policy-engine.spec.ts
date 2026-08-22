/**
 * P0-6 — policy engine qaror matritsasi.
 *
 * Blueprint DoD: "12 policy kombinatsiyasi → kutilgan tier" va
 * "`gmail.read` → LOW; `gmail.send` (10 tashqi) → HIGH — bir xil emas".
 *
 * ⚠️ `gmail` REGISTRDA YO'Q (17 konnektor ro'yxatida u yo'q). Tamoyil
 * o'zgarmaydi, misol esa HAQIQIY konnektorlarga ko'chirildi:
 *   `google-sheets` (o'qish, LOW) vs `telegram-bot` (yuborish, HIGH+).
 * Blueprint misoli illyustrativ edi — bu farq §10 da qayd etilgan.
 */

import { RiskTier } from '@prisma/client';
import { PolicyEngine } from './policy-engine.service';
import type { PolicyInput } from './policy.types';

const engine = new PolicyEngine();

/** Minimal to'liq kirish — testlar faqat kerakli o'lchamni o'zgartiradi. */
function input(over: Partial<PolicyInput> = {}): PolicyInput {
  return {
    actor: 'agent',
    agent: { id: 'a1', killedAt: null },
    tool: { connectorId: 'google-sheets', actionId: 'read_range' },
    target: { kind: 'self' },
    data: { containsPersonal: false, fromUntrustedSource: false },
    action: 'read',
    context: { stepIndex: 1, untrustedContentSeen: false },
    scope: { size: 1 },
    ...over,
  };
}

describe('⚠️ ASOSIY FARQ — o‘qish va yuborish bir xil risk EMAS', () => {
  it('google-sheets.read (o‘zi uchun, 1 ta) → LOW, tasdiq kerak emas', () => {
    const d = engine.evaluate(input());
    expect(d.tier).toBe(RiskTier.LOW);
    expect(d.requiresApproval).toBe(false);
    expect(d.allow).toBe(true);
  });

  it('telegram-bot.send 10 ta TASHQI qabul qiluvchiga → CRITICAL, tasdiq SHART', () => {
    const d = engine.evaluate(
      input({
        tool: { connectorId: 'telegram-bot', actionId: 'send_message' },
        action: 'send',
        target: { kind: 'external', identifiers: Array.from({ length: 10 }, (_, i) => `u${i}`) },
        scope: { size: 10 },
      }),
    );
    expect(d.tier).toBe(RiskTier.CRITICAL);
    expect(d.requiresApproval).toBe(true);
  });

  it('ikki qaror BIR XIL EMAS (tool nomiga qarab belgilash buni ko‘rmaydi)', () => {
    const read = engine.evaluate(input());
    const send = engine.evaluate(
      input({
        tool: { connectorId: 'telegram-bot', actionId: 'send_message' },
        action: 'send',
        target: { kind: 'external' },
        scope: { size: 10 },
      }),
    );
    expect(read.tier).not.toBe(send.tier);
  });
});

describe('12 kombinatsiya — tier matritsasi', () => {
  const cases: Array<[string, Partial<PolicyInput>, RiskTier]> = [
    // 1–2: o'qish amallari
    ['sheets o‘qish, o‘zi', {}, RiskTier.LOW],
    ['aftership o‘qish', { tool: { connectorId: 'aftership-tracking', actionId: 'track' } }, RiskTier.LOW],
    // 3: ichki yozuv
    [
      'CRM yozuv (qaytariladi), 1 ta',
      { tool: { connectorId: 'amocrm', actionId: 'create_lead' }, action: 'write', target: { kind: 'internal' } },
      RiskTier.HIGH, // konnektor minimal tieri HIGH
    ],
    // 4–5: SMS (qaytarilmaydi)
    [
      'SMS 1 ta raqamga',
      { tool: { connectorId: 'eskiz-sms', actionId: 'send_sms' }, action: 'send', target: { kind: 'external' }, scope: { size: 1 } },
      RiskTier.CRITICAL, // reversible:false + send
    ],
    [
      'SMS 100 ta raqamga',
      { tool: { connectorId: 'eskiz-sms', actionId: 'send_sms' }, action: 'send', target: { kind: 'external' }, scope: { size: 100 } },
      RiskTier.CRITICAL,
    ],
    // 6–7: to'lov va davlat
    [
      'Payme to‘lov',
      { tool: { connectorId: 'payme-merchant', actionId: 'create_invoice' }, action: 'pay', target: { kind: 'external' } },
      RiskTier.CRITICAL,
    ],
    [
      'soliq hujjat topshirish',
      { tool: { connectorId: 'soliq-uz', actionId: 'submit' }, action: 'submit', target: { kind: 'external' } },
      RiskTier.CRITICAL,
    ],
    // 8: soliq O'QISH — pasaytirilmaydi (ataylab)
    [
      'soliq o‘qish — CRITICAL bo‘lib qoladi (pasaytirish ADR talab qiladi)',
      { tool: { connectorId: 'soliq-uz', actionId: 'get_report' }, action: 'read' },
      RiskTier.CRITICAL,
    ],
    // 9: o'chirish
    [
      'sheets o‘chirish',
      { tool: { connectorId: 'google-sheets', actionId: 'clear' }, action: 'delete', target: { kind: 'internal' } },
      RiskTier.CRITICAL,
    ],
    // 10: noma'lum konnektor → default HIGH
    [
      'noma‘lum konnektor → default HIGH',
      { tool: { connectorId: 'yoq-bunday-konnektor', actionId: 'x' }, action: 'read' },
      RiskTier.HIGH,
    ],
    // 11: blast radius o'qishda ko'tarmaydi
    [
      'sheets o‘qish 100 qatordan — LOW bo‘lib qoladi? YO‘Q: scope ko‘taradi',
      { scope: { size: 100 } },
      RiskTier.CRITICAL,
    ],
    // 12: lethal trifecta
    [
      'shaxsiy data + ishonchsiz kontent + tashqi yuborish',
      {
        tool: { connectorId: 'smtp-email', actionId: 'send' },
        action: 'send',
        target: { kind: 'external' },
        data: { containsPersonal: true, fromUntrustedSource: true },
        context: { stepIndex: 3, untrustedContentSeen: true },
      },
      RiskTier.CRITICAL,
    ],
  ];

  it.each(cases)('%s → %s', (_name, over, expected) => {
    expect(engine.evaluate(input(over)).tier).toBe(expected);
  });
});

describe('lethal trifecta (§1)', () => {
  it('uch shart birga bo‘lganda sabab ro‘yxatida ko‘rinadi', () => {
    const d = engine.evaluate(
      input({
        tool: { connectorId: 'amocrm', actionId: 'push' },
        action: 'send',
        target: { kind: 'external' },
        data: { containsPersonal: true, fromUntrustedSource: true },
        context: { stepIndex: 2, untrustedContentSeen: true },
      }),
    );
    expect(d.reasons).toContain('lethal_trifecta');
    expect(d.tier).toBe(RiskTier.CRITICAL);
  });

  it('faqat ishonchsiz kontent (shaxsiy data yo‘q) — trifecta EMAS', () => {
    const d = engine.evaluate(
      input({
        tool: { connectorId: 'amocrm', actionId: 'push' },
        action: 'write',
        target: { kind: 'internal' },
        data: { containsPersonal: false, fromUntrustedSource: true },
        context: { stepIndex: 2, untrustedContentSeen: true },
      }),
    );
    expect(d.reasons).not.toContain('lethal_trifecta');
  });
});

describe('kill switch — hamma narsadan OLDIN', () => {
  it('to‘xtatilgan agentda LOW amal ham bloklanadi', () => {
    const d = engine.evaluate(input({ agent: { id: 'a1', killedAt: new Date() } }));
    expect(d.allow).toBe(false);
    expect(d.reasons).toContain('agent_killed');
    expect(d.appliedRules).toContain('kill-switch');
  });
});

describe('qaytarilmaslik (§5)', () => {
  it('`reversible: false` + yon ta‘sir → CRITICAL', () => {
    const d = engine.evaluate(
      input({
        tool: { connectorId: 'telegram-bot', actionId: 'send_message' },
        action: 'send',
        target: { kind: 'external' },
      }),
    );
    expect(d.reasons).toContain('irreversible_action');
  });

  it('`reversible: false` lekin O‘QISH → CRITICAL ga ko‘tarilmaydi bu sabab bilan', () => {
    const d = engine.evaluate(
      input({ tool: { connectorId: 'telegram-bot', actionId: 'get_updates' }, action: 'read' }),
    );
    expect(d.reasons).not.toContain('irreversible_action');
  });
});

describe('⚠️ FAIL-CLOSED', () => {
  it('kirish buzuq bo‘lsa amal BLOKLANADI (ruxsat berilmaydi)', () => {
    // `scope` yo'q — ichida `input.scope.size` o'qilganda throw bo'ladi.
    const d = engine.evaluate({ ...input(), scope: undefined as never });
    expect(d.allow).toBe(false);
    expect(d.tier).toBe(RiskTier.CRITICAL);
    expect(d.appliedRules).toContain('fail-closed');
  });

  it('hech qachon throw QILMAYDI', () => {
    expect(() => engine.evaluate({} as never)).not.toThrow();
  });
});

describe('P0 majburlash chegarasi (§2.2)', () => {
  it('faqat LOW avtomatik; MEDIUM/HIGH/CRITICAL tasdiq talab qiladi', () => {
    expect(engine.evaluate(input()).requiresApproval).toBe(false);
    for (const over of [
      { tool: { connectorId: 'amocrm', actionId: 'x' }, action: 'write' as const },
      { tool: { connectorId: 'eskiz-sms', actionId: 'x' }, action: 'send' as const },
      { tool: { connectorId: 'payme-merchant', actionId: 'x' }, action: 'pay' as const },
    ]) {
      expect(engine.evaluate(input(over)).requiresApproval).toBe(true);
    }
  });
});
