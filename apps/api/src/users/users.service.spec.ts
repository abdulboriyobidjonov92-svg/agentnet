import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * UsersService — GDPR yo'llari (exportData/deleteAccount) va 2FA sirlarining
 * hech qachon javob-obyektiga sizib chiqmasligi (getProfile/exportData).
 */

function baseUser(overrides: Record<string, any> = {}) {
  return {
    id: 'u1',
    email: 'a@b.com',
    role: 'MEMBER',
    twoFactorEnabled: true,
    twoFactorSecret: 'JBSWY3DPEHPK3PXP',
    twoFactorSecretPending: 'PENDINGSECRET',
    valuesProfile: null,
    ...overrides,
  };
}

function makeMock() {
  const prisma: any = {
    user: {
      upsert: jest.fn(async (a: any) => ({ id: 'u1', ...a.create })),
      findUnique: jest.fn(),
      update: jest.fn(async (a: any) => ({ ...baseUser(), ...a.data })),
      $transaction: jest.fn(),
    },
    agent: { count: jest.fn(async () => 0), findMany: jest.fn(async () => []) },
    conversation: { count: jest.fn(async () => 0), findMany: jest.fn(async () => []) },
    creditLedger: { findMany: jest.fn(async () => []) },
    connectorConfig: { findMany: jest.fn(async () => []) },
    feedback: { findMany: jest.fn(async () => []) },
    usageCounter: { findMany: jest.fn(async () => []) },
    auditLog: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  return { prisma };
}

describe('UsersService.syncFromClerk', () => {
  it("mavjud bo'lmasa MEMBER sifatida yaratadi, bo'lsa emailni yangilaydi", async () => {
    const { prisma } = makeMock();
    const svc = new UsersService(prisma);

    await svc.syncFromClerk('clerk_1', 'new@b.com');

    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { clerkId: 'clerk_1' },
      update: { email: 'new@b.com' },
      create: expect.objectContaining({ clerkId: 'clerk_1', email: 'new@b.com', role: 'MEMBER' }),
    });
  });
});

describe('UsersService.getProfile — 2FA sirlari sizib chiqmasligi', () => {
  it('twoFactorSecret va twoFactorSecretPending javobda YO\'Q', async () => {
    const { prisma } = makeMock();
    prisma.user.findUnique.mockResolvedValue({ ...baseUser(), org: { name: 'Org', slug: 'org' } });
    const svc = new UsersService(prisma);

    const profile = await svc.getProfile('u1');

    expect(profile).not.toHaveProperty('twoFactorSecret');
    expect(profile).not.toHaveProperty('twoFactorSecretPending');
    expect(profile).toHaveProperty('email', 'a@b.com');
  });

  it("mavjud bo'lmagan foydalanuvchi -> NotFoundException", async () => {
    const { prisma } = makeMock();
    prisma.user.findUnique.mockResolvedValue(null);
    const svc = new UsersService(prisma);

    await expect(svc.getProfile('yoq')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UsersService.updateProfile', () => {
  it("bo'sh/faqat probel nom -> null (trim qilinadi)", async () => {
    const { prisma } = makeMock();
    const svc = new UsersService(prisma);

    await svc.updateProfile('u1', { name: '   ' });

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: expect.objectContaining({ name: null }) });
  });

  it('name berilmasa data ichida umuman yo\'q (mavjud qiymatni tozalamaydi)', async () => {
    const { prisma } = makeMock();
    const svc = new UsersService(prisma);

    await svc.updateProfile('u1', { tourCompleted: true });

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('name');
    expect(data.tourCompleted).toBe(true);
  });
});

describe('UsersService.updateValues', () => {
  it("noma'lum tradition -> 'islamic' ga tushadi, statements 10 tagacha qisqaradi", async () => {
    const { prisma } = makeMock();
    const svc = new UsersService(prisma);
    const statements = Array.from({ length: 15 }, (_, i) => `  bayonot ${i}  `);

    await svc.updateValues('u1', { tradition: 'boshqa-narsa', statements });

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.valuesProfile.tradition).toBe('islamic');
    expect(data.valuesProfile.statements).toHaveLength(10);
    expect(data.valuesProfile.statements[0]).toBe('bayonot 0'); // trim qilingan
  });

  it('bo\'sh bayonotlar filtrlanadi', async () => {
    const { prisma } = makeMock();
    const svc = new UsersService(prisma);

    await svc.updateValues('u1', { tradition: 'secular', statements: ['haqiqiy', '   ', ''] });

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.valuesProfile.statements).toEqual(['haqiqiy']);
  });
});

describe('UsersService.exportData — GDPR eksport sirlarsiz', () => {
  it("2FA sirlari yo'q, konnektor config'i (sir) tanlanmagan — faqat metama'lumot", async () => {
    const { prisma } = makeMock();
    prisma.user.findUnique.mockResolvedValue(baseUser());
    prisma.connectorConfig.findMany.mockResolvedValue([{ connectorId: 'telegram-bot', label: 'default', status: 'connected', createdAt: new Date(), lastUsedAt: null }]);
    const svc = new UsersService(prisma);

    const out = await svc.exportData('u1');

    expect(out.user).not.toHaveProperty('twoFactorSecret');
    expect(out.user).not.toHaveProperty('twoFactorSecretPending');
    const selectArg = prisma.connectorConfig.findMany.mock.calls[0][0].select;
    expect(selectArg).not.toHaveProperty('config');
    expect(out.connectors[0]).not.toHaveProperty('config');
  });

  it("mavjud bo'lmagan foydalanuvchi -> NotFoundException", async () => {
    const { prisma } = makeMock();
    prisma.user.findUnique.mockResolvedValue(null);
    const svc = new UsersService(prisma);

    await expect(svc.exportData('yoq')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UsersService.deleteAccount — Restrict bog\'lanishlarni to\'g\'ri tartibda o\'chiradi', () => {
  it("auditLog -> conversation -> agent -> user tartibida bitta transaksiyada o'chiradi", async () => {
    const { prisma } = makeMock();
    const svc = new UsersService(prisma);
    const calls: string[] = [];
    prisma.auditLog.deleteMany.mockImplementation(async () => { calls.push('auditLog'); return { count: 0 }; });
    prisma.conversation.deleteMany = jest.fn(async () => { calls.push('conversation'); });
    prisma.agent.deleteMany = jest.fn(async () => { calls.push('agent'); });
    prisma.user.delete = jest.fn(async () => { calls.push('user'); });

    const res = await svc.deleteAccount('u1');

    expect(calls).toEqual(['auditLog', 'conversation', 'agent', 'user']);
    expect(res).toEqual({ deleted: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
