/**
 * P0-6 — tasdiq qarori va TASDIQLANGAN AMALNI BAJARISH.
 *
 * Bu zanjir P0-6 dagi "tasdiqlab davom etish yo'q" cheklovini yopadi:
 * ilgari tasdiq tugmasi faqat yozuv qoldirardi, amal esa bloklangan
 * holicha qolardi.
 */

import { BadRequestException } from '@nestjs/common';
import { ApprovalDecision, ExecutionEventType, RiskTier } from '@prisma/client';
import { ApprovalService, PENDING_LATENCY } from './approval.service';
import type { User } from '@prisma/client';

const user = { id: 'u1' } as unknown as User;

const PROPOSED = {
  connector: 'telegram-bot',
  action: 'send_message',
  params: { chat_id: '111', text: 'salom' },
};

function setup(over: Partial<Record<string, unknown>> = {}) {
  const row: any = {
    id: 'ap1',
    runId: 'run1',
    stepId: 's1',
    agentId: 'a1',
    userId: 'u1',
    riskTier: RiskTier.HIGH,
    proposedAction: PROPOSED,
    modifiedAction: null,
    decision: ApprovalDecision.REJECTED,
    latencyMs: PENDING_LATENCY,
    createdAt: new Date(Date.now() - 5_000),
    ...over,
  };
  const emitted: any[] = [];
  const prisma = {
    approvalEvent: {
      findFirst: jest.fn(async () => row),
      update: jest.fn(async ({ data }: any) => Object.assign(row, data)),
      create: jest.fn(async ({ data }: any) => ({ ...row, ...data })),
    },
  };
  const bus = { emit: jest.fn(async (e: any) => { emitted.push(e); return null; }) };
  const connectors = { invokeApproved: jest.fn(async () => ({ ok: true, data: 'yuborildi' })) };
  const svc = new ApprovalService(prisma as never, bus as never, connectors as never);
  return { svc, prisma, bus, connectors, emitted, row };
}

describe('decide — qaror yozilishi', () => {
  it('MODIFIED uchun modifiedAction MAJBURIY', async () => {
    const { svc, connectors } = setup();
    await expect(
      svc.decide(user, 'ap1', { decision: ApprovalDecision.MODIFIED }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(connectors.invokeApproved).not.toHaveBeenCalled();
  });

  it('allaqachon qaror qabul qilingan so‘rov qayta hal qilinmaydi', async () => {
    const { svc } = setup({ latencyMs: 1200 });
    await expect(
      svc.decide(user, 'ap1', { decision: ApprovalDecision.APPROVED }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('begona so‘rov topilmaydi', async () => {
    const { svc, prisma } = setup();
    prisma.approvalEvent.findFirst = jest.fn(async () => null) as never;
    await expect(
      svc.decide(user, 'ap1', { decision: ApprovalDecision.APPROVED }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('⚠️ RAD ETILGANDA amal BAJARILMAYDI', () => {
  it('invokeApproved chaqirilmaydi', async () => {
    const { svc, connectors } = setup();
    const out = await svc.decide(user, 'ap1', { decision: ApprovalDecision.REJECTED });
    expect(connectors.invokeApproved).not.toHaveBeenCalled();
    expect(out).toMatchObject({ executed: false });
  });

  it('APPROVAL_DENIED hodisasi yoziladi', async () => {
    const { svc, emitted } = setup();
    await svc.decide(user, 'ap1', { decision: ApprovalDecision.REJECTED });
    expect(emitted.map((e) => e.type)).toContain(ExecutionEventType.APPROVAL_DENIED);
  });
});

describe('TASDIQLANGANDA amal BAJARILADI', () => {
  it('taklif qilingan amal aynan bajariladi', async () => {
    const { svc, connectors } = setup();

    const out = await svc.decide(user, 'ap1', { decision: ApprovalDecision.APPROVED });

    expect(connectors.invokeApproved).toHaveBeenCalledWith(
      user,
      expect.objectContaining({
        connectorId: 'telegram-bot',
        actionId: 'send_message',
        params: { chat_id: '111', text: 'salom' },
        agentId: 'a1',
      }),
    );
    expect(out).toMatchObject({ executed: true, ok: true });
  });

  it('trace zanjiri to‘liq: APPROVAL_GRANTED → TOOL_STARTED → TOOL_RESULT', async () => {
    const { svc, emitted } = setup();
    await svc.decide(user, 'ap1', { decision: ApprovalDecision.APPROVED });
    expect(emitted.map((e) => e.type)).toEqual([
      ExecutionEventType.APPROVAL_GRANTED,
      ExecutionEventType.TOOL_STARTED,
      ExecutionEventType.TOOL_RESULT,
    ]);
  });

  it('amal yiqilsa TOOL_FAILED yoziladi, qaror YO‘QOLMAYDI', async () => {
    const { svc, connectors, emitted } = setup();
    connectors.invokeApproved = jest.fn(async () => ({ ok: false, error: 'API 500' })) as never;

    const out = await svc.decide(user, 'ap1', { decision: ApprovalDecision.APPROVED });

    expect(emitted.map((e) => e.type)).toContain(ExecutionEventType.TOOL_FAILED);
    expect(out).toMatchObject({ executed: true, ok: false, error: 'API 500' });
  });

  it('⚠️ invokeApproved THROW qilsa ham qaror yozilgan qoladi', async () => {
    const { svc, connectors, prisma, emitted } = setup();
    connectors.invokeApproved = jest.fn(async () => {
      throw new Error('agent to‘xtatilgan');
    }) as never;

    const out = await svc.decide(user, 'ap1', { decision: ApprovalDecision.APPROVED });

    expect(prisma.approvalEvent.update).toHaveBeenCalled(); // qaror saqlangan
    expect(emitted.map((e) => e.type)).toContain(ExecutionEventType.TOOL_FAILED);
    expect(out).toMatchObject({ executed: true, ok: false });
  });
});

describe('TUZATILGAN amal bajariladi', () => {
  it('parametrlar tuzatilgan holda ketadi', async () => {
    const { svc, connectors, row } = setup();
    // `update` mock'i row'ni yangilaydi — `modifiedAction` shu yerda paydo bo'ladi.
    row.modifiedAction = { ...PROPOSED, params: { chat_id: '999', text: 'tuzatildi' } };

    await svc.decide(user, 'ap1', {
      decision: ApprovalDecision.MODIFIED,
      modifiedAction: row.modifiedAction,
    });

    expect(connectors.invokeApproved).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ params: { chat_id: '999', text: 'tuzatildi' } }),
    );
  });

  it('⚠️ konnektor almashtirilgan bo‘lsa BAJARILMAYDI', async () => {
    const { svc, connectors, row } = setup();
    row.modifiedAction = { connector: 'payme-merchant', action: 'send_message', params: {} };

    await expect(
      svc.decide(user, 'ap1', {
        decision: ApprovalDecision.MODIFIED,
        modifiedAction: row.modifiedAction,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(connectors.invokeApproved).not.toHaveBeenCalled();
  });
});
