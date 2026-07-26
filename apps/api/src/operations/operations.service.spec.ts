import { NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { OperationsService } from './operations.service';
import type { User } from '@prisma/client';

/**
 * OperationsService — payroll (soat × stavka, soliqsiz — halol chegara)
 * deterministik hisob-kitobi, smena-reja rekonsiliatsiyasi, va tashqi
 * xabar yuborish faqat egasi tasdiqlagandan keyin (approve → send).
 */

function makeMock() {
  const prisma: any = {
    employee: { findMany: jest.fn(async () => []), create: jest.fn(async (a: any) => ({ id: 'e1', ...a.data })), findFirst: jest.fn(), update: jest.fn(async (a: any) => a) },
    shift: { findMany: jest.fn(async () => []), create: jest.fn(async (a: any) => ({ id: 's1', ...a.data })), deleteMany: jest.fn(async () => ({ count: 0 })), findFirst: jest.fn(), update: jest.fn(async (a: any) => ({ ...a })) },
    timeOff: { create: jest.fn(async (a: any) => ({ id: 'to1', status: 'pending', ...a.data })), findFirst: jest.fn(), update: jest.fn(async (a: any) => a), findMany: jest.fn(async () => []) },
    org: { findUnique: jest.fn(async () => null) },
    outboundMessage: { create: jest.fn(async (a: any) => ({ id: 'm1', status: 'draft', ...a.data })), findFirst: jest.fn(), update: jest.fn(async (a: any) => ({ ...a })), findMany: jest.fn(async () => []) },
  };
  const http = { post: jest.fn(), get: jest.fn() } as any;
  const audit = { record: jest.fn(async () => {}) } as any;
  const connectors = { sendViaChannel: jest.fn() } as any;
  return { prisma, http, audit, connectors };
}

const user = { id: 'u1', orgId: null, preferredLanguage: 'uz' } as unknown as User;

describe('OperationsService.payroll — soat × stavka (soliqsiz, halol chegara)', () => {
  it("soatlik stavka -> soat * stavka", async () => {
    const { prisma, http, audit, connectors } = makeMock();
    prisma.shift.findMany.mockResolvedValue([
      { employeeId: 'e1', startTime: '09:00', endTime: '18:00', status: 'completed', employee: { name: 'Ali', hourlyRate: 20_000, monthlyRate: null } },
    ]);
    const svc = new OperationsService(prisma, http, audit, connectors);

    const res = await svc.payroll(user, '2026-07-01', '2026-07-07');

    expect(res.rows[0].hours).toBe(9);
    expect(res.rows[0].rate_type).toBe('hourly');
    expect(res.rows[0].gross_tiyin).toBe(9 * 20_000);
    expect(res.note).toContain('NOT included');
  });

  it("oylik stavka -> proporsional (176 soat norma)", async () => {
    const { prisma, http, audit, connectors } = makeMock();
    prisma.shift.findMany.mockResolvedValue([
      { employeeId: 'e1', startTime: '09:00', endTime: '13:00', status: 'completed', employee: { name: 'Vali', hourlyRate: null, monthlyRate: 3_520_000 } },
    ]);
    const svc = new OperationsService(prisma, http, audit, connectors);

    const res = await svc.payroll(user, '2026-07-01', '2026-07-07');

    expect(res.rows[0].rate_type).toBe('monthly_prorated');
    expect(res.rows[0].gross_tiyin).toBe(Math.round((4 / 176) * 3_520_000));
  });

  it("stavka o'rnatilmagan -> gross 0, rate_type 'no_rate_set'", async () => {
    const { prisma, http, audit, connectors } = makeMock();
    prisma.shift.findMany.mockResolvedValue([
      { employeeId: 'e1', startTime: '09:00', endTime: '17:00', status: 'completed', employee: { name: 'Iroda', hourlyRate: null, monthlyRate: null } },
    ]);
    const svc = new OperationsService(prisma, http, audit, connectors);

    const res = await svc.payroll(user, '2026-07-01', '2026-07-07');
    expect(res.rows[0].rate_type).toBe('no_rate_set');
    expect(res.rows[0].gross_tiyin).toBe(0);
  });

  it("bir nechta smena bitta xodim uchun jamlanadi", async () => {
    const { prisma, http, audit, connectors } = makeMock();
    prisma.shift.findMany.mockResolvedValue([
      { employeeId: 'e1', startTime: '09:00', endTime: '13:00', status: 'completed', employee: { name: 'Ali', hourlyRate: 10_000, monthlyRate: null } },
      { employeeId: 'e1', startTime: '14:00', endTime: '18:00', status: 'scheduled', employee: { name: 'Ali', hourlyRate: 10_000, monthlyRate: null } },
    ]);
    const svc = new OperationsService(prisma, http, audit, connectors);

    const res = await svc.payroll(user, '2026-07-01', '2026-07-07');
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].hours).toBe(8);
    expect(res.rows[0].shifts).toBe(2);
    expect(res.totals.hours).toBe(8);
  });

  it("yaroqsiz vaqt formati (NaN) -> 0 soat, yiqilmaydi", async () => {
    const { prisma, http, audit, connectors } = makeMock();
    prisma.shift.findMany.mockResolvedValue([
      { employeeId: 'e1', startTime: 'noto\'g\'ri', endTime: '18:00', status: 'completed', employee: { name: 'Ali', hourlyRate: 10_000, monthlyRate: null } },
    ]);
    const svc = new OperationsService(prisma, http, audit, connectors);

    const res = await svc.payroll(user, '2026-07-01', '2026-07-07');
    expect(res.rows[0].hours).toBe(0);
  });

  it("tugash boshlanishdan oldin bo'lsa -> manfiy emas, 0 ga cheklanadi", async () => {
    const { prisma, http, audit, connectors } = makeMock();
    prisma.shift.findMany.mockResolvedValue([
      { employeeId: 'e1', startTime: '18:00', endTime: '09:00', status: 'completed', employee: { name: 'Ali', hourlyRate: 10_000, monthlyRate: null } },
    ]);
    const svc = new OperationsService(prisma, http, audit, connectors);

    const res = await svc.payroll(user, '2026-07-01', '2026-07-07');
    expect(res.rows[0].hours).toBe(0);
    expect(res.rows[0].gross_tiyin).toBe(0);
  });
});

describe('OperationsService.setShiftStatus', () => {
  it("noma'lum status -> e'tiborsiz qoldiriladi (mavjud status saqlanadi)", async () => {
    const { prisma, http, audit, connectors } = makeMock();
    prisma.shift.findFirst.mockResolvedValue({ id: 's1', userId: 'u1', status: 'scheduled' });
    const svc = new OperationsService(prisma, http, audit, connectors);

    await svc.setShiftStatus(user, 's1', 'not-a-real-status');
    expect(prisma.shift.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { status: 'scheduled' } });
  });

  it("mavjud bo'lmagan smena -> NotFoundException", async () => {
    const { prisma, http, audit, connectors } = makeMock();
    prisma.shift.findFirst.mockResolvedValue(null);
    const svc = new OperationsService(prisma, http, audit, connectors);

    await expect(svc.setShiftStatus(user, 'yoq', 'completed')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('OperationsService.removeEmployee', () => {
  it("boshqa foydalanuvchining xodimini o'chira olmaydi (topilmadi)", async () => {
    const { prisma, http, audit, connectors } = makeMock();
    prisma.employee.findFirst.mockResolvedValue(null);
    const svc = new OperationsService(prisma, http, audit, connectors);

    await expect(svc.removeEmployee(user, 'yoq')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('OperationsService.generateSchedule', () => {
  it("engine rejasini haqiqiy Shift yozuvlariga aylantiradi, tanilmagan xodim o'tkazib yuboriladi", async () => {
    const { prisma, http, audit, connectors } = makeMock();
    prisma.employee.findMany.mockResolvedValue([{ id: 'e1', name: 'Ali', timeOffs: [] }]);
    http.post.mockReturnValue(
      of({
        data: {
          method: 'llm',
          week_start: '2026-07-27',
          shifts: [
            { employee: 'Ali', date: '2026-07-27', start: '09:00', end: '18:00' },
            { employee: "Noma'lum xodim", date: '2026-07-27', start: '09:00', end: '18:00' },
          ],
        },
      }),
    );
    const svc = new OperationsService(prisma, http, audit, connectors);

    const res = await svc.generateSchedule(user, "haftalik jadval tuz");

    expect(prisma.shift.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u1', status: 'scheduled' }) }),
    );
    expect(prisma.shift.create).toHaveBeenCalledTimes(1); // faqat Ali uchun
    expect(res.created).toBe(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'ops.schedule_generate', metadata: expect.objectContaining({ created: 1 }) }));
  });

  it("engine 422 halal-block bersa -> UnprocessableEntityException, hech qanday Shift yaratilmaydi", async () => {
    const { prisma, http, audit, connectors } = makeMock();
    http.post.mockReturnValue(
      throwError(() => ({ response: { status: 422, data: { detail: { blocked: true, reason: 'illegal' } } } })),
    );
    const svc = new OperationsService(prisma, http, audit, connectors);

    await expect(svc.generateSchedule(user, 'reja')).rejects.toMatchObject({ status: 422 });
    expect(prisma.shift.create).not.toHaveBeenCalled();
  });
});

describe('OperationsService.approveAndSend — faqat tasdiqdan keyin yuboriladi', () => {
  it("muvaffaqiyatli yuborish -> status='sent', sentAt o'rnatiladi", async () => {
    const { prisma, http, audit, connectors } = makeMock();
    prisma.outboundMessage.findFirst.mockResolvedValue({ id: 'm1', userId: 'u1', channel: 'telegram', recipientContact: '777', body: 'Salom', subject: null, meta: { purpose: 'reminder' } });
    connectors.sendViaChannel.mockResolvedValue({ ok: true });
    const svc = new OperationsService(prisma, http, audit, connectors);

    const res = await svc.approveAndSend(user, 'm1');

    expect(connectors.sendViaChannel).toHaveBeenCalledWith(user, 'telegram', '777', 'Salom', undefined);
    expect(prisma.outboundMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'sent', sentAt: expect.any(Date) }) }),
    );
    expect(res.delivery.ok).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ ok: true }) }));
  });

  it("yetkazib berish muvaffaqiyatsiz -> status='failed', sentAt=null, sabab meta'da saqlanadi", async () => {
    const { prisma, http, audit, connectors } = makeMock();
    prisma.outboundMessage.findFirst.mockResolvedValue({ id: 'm1', userId: 'u1', channel: 'sms', recipientContact: '998901234567', body: 'Salom', subject: null, meta: {} });
    connectors.sendViaChannel.mockResolvedValue({ ok: false, error: 'credentials yo\'q', needs: 'credentials' });
    const svc = new OperationsService(prisma, http, audit, connectors);

    const res = await svc.approveAndSend(user, 'm1');

    expect(prisma.outboundMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed', sentAt: null, meta: expect.objectContaining({ deliveryResult: "credentials yo'q" }) }),
      }),
    );
    expect(res.delivery.ok).toBe(false);
  });

  it("mavjud bo'lmagan xabar -> NotFoundException, connector chaqirilmaydi", async () => {
    const { prisma, http, audit, connectors } = makeMock();
    prisma.outboundMessage.findFirst.mockResolvedValue(null);
    const svc = new OperationsService(prisma, http, audit, connectors);

    await expect(svc.approveAndSend(user, 'yoq')).rejects.toBeInstanceOf(NotFoundException);
    expect(connectors.sendViaChannel).not.toHaveBeenCalled();
  });
});
