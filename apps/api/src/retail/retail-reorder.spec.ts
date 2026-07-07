import { NotFoundException } from '@nestjs/common';
import { RetailService } from './retail.service';
import type { User } from '@prisma/client';

/**
 * reorderPlan() HECH QACHON o'zi yubormasligi va confirm/cancel bir marta
 * qaror qilingandan keyin idempotent bo'lishi — MVP ishonch talabi.
 */

function makeDeps() {
  const prisma = {
    retailProduct: { findMany: jest.fn(async () => []), findUnique: jest.fn(), update: jest.fn() },
    retailSale: { findMany: jest.fn(async () => []) },
    reorderDraft: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    retailSettings: { findUnique: jest.fn(async (): Promise<any> => null) },
  };
  const http = { post: jest.fn() } as any;
  const audit = { record: jest.fn(async () => {}) } as any;
  const connectors = { sendViaChannel: jest.fn(async () => ({ ok: true })) } as any;
  const pos = {
    listProducts: jest.fn(async () => []),
    listSales: jest.fn(async () => []),
    recordSale: jest.fn(),
  };
  return { prisma, http, audit, connectors, pos };
}

const user = { id: 'u1', preferredLanguage: 'uz' } as unknown as User;

describe('RetailService reorder draft — bir martalik tasdiq (avto-yuborilmaydi)', () => {
  it('mavjud bo\'lmagan qoralamani tasdiqlash 404 tashlaydi', async () => {
    const { prisma, http, audit, connectors, pos } = makeDeps();
    prisma.reorderDraft.findFirst.mockResolvedValue(null);
    const svc = new RetailService(prisma as any, http, audit, connectors, pos as any);

    await expect(svc.confirmReorderDraft(user, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('pending qoralama tasdiqlansa — kanalga yuboriladi va status approved bo\'ladi', async () => {
    const { prisma, http, audit, connectors, pos } = makeDeps();
    const draft = { id: 'd1', userId: 'u1', sku: 'SUT-1L', status: 'pending', message: 'xabar', orderQty: 10 };
    prisma.reorderDraft.findFirst.mockResolvedValue(draft);
    prisma.reorderDraft.update.mockResolvedValue({ ...draft, status: 'approved', decidedAt: new Date() });
    prisma.retailSettings.findUnique.mockResolvedValue({ channel: 'telegram', target: 'chat123', autoNotify: true });
    const svc = new RetailService(prisma as any, http, audit, connectors, pos as any);

    const res = await svc.confirmReorderDraft(user, 'd1');

    expect(connectors.sendViaChannel).toHaveBeenCalledWith(user, 'telegram', 'chat123', 'xabar');
    expect(res.status).toBe('approved');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'retail.reorder_approved' }));
  });

  it('ikkinchi marta tasdiqlash — IKKINCHI marta yuborilmaydi (idempotent)', async () => {
    const { prisma, http, audit, connectors, pos } = makeDeps();
    const decided = { id: 'd1', userId: 'u1', sku: 'SUT-1L', status: 'approved', message: 'xabar', orderQty: 10 };
    prisma.reorderDraft.findFirst.mockResolvedValue(decided);
    const svc = new RetailService(prisma as any, http, audit, connectors, pos as any);

    const res = await svc.confirmReorderDraft(user, 'd1');

    expect(connectors.sendViaChannel).not.toHaveBeenCalled();
    expect(prisma.reorderDraft.update).not.toHaveBeenCalled();
    expect(res.status).toBe('approved');
  });

  it('bekor qilingan qoralama uchun ham yuborilmaydi', async () => {
    const { prisma, http, audit, connectors, pos } = makeDeps();
    const draft = { id: 'd1', userId: 'u1', sku: 'SUT-1L', status: 'pending', message: 'xabar', orderQty: 10 };
    prisma.reorderDraft.findFirst.mockResolvedValue(draft);
    prisma.reorderDraft.update.mockResolvedValue({ ...draft, status: 'rejected', decidedAt: new Date() });
    const svc = new RetailService(prisma as any, http, audit, connectors, pos as any);

    const res = await svc.cancelReorderDraft(user, 'd1');

    expect(connectors.sendViaChannel).not.toHaveBeenCalled();
    expect(res.status).toBe('rejected');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'retail.reorder_rejected' }));
  });
});
