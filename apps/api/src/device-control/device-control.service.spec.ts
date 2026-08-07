import { BadRequestException } from '@nestjs/common';
import type { DeviceCategory } from '@prisma/client';
import { DeviceControlService } from './device-control.service';
import type { User } from '@prisma/client';

function makeMockPrisma() {
  const permissions: any[] = [];
  const logs: any[] = [];
  return {
    _permissions: permissions,
    _logs: logs,
    devicePermission: {
      findMany: jest.fn(async ({ where }: any) => permissions.filter((p) => p.userId === where.userId)),
      findUnique: jest.fn(async ({ where }: any) => {
        const k = where.userId_deviceType_category;
        return (
          permissions.find(
            (p) => p.userId === k.userId && p.deviceType === k.deviceType && p.category === k.category,
          ) ?? null
        );
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const k = where.userId_deviceType_category;
        const existing = permissions.find(
          (p) => p.userId === k.userId && p.deviceType === k.deviceType && p.category === k.category,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { id: `p${permissions.length + 1}`, ...create };
        permissions.push(row);
        return row;
      }),
    },
    deviceActionLog: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `l${logs.length + 1}`, createdAt: new Date(), ...data };
        logs.push(row);
        return row;
      }),
      findMany: jest.fn(async ({ where, take }: any) => logs.filter((l) => l.userId === where.userId).slice(0, take)),
    },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
  };
}

const user = { id: 'u1' } as unknown as User;

describe('DeviceControlService', () => {
  it('getStatus — hech qanday ruxsat yozuvi bo\'lmasa, hammasi o\'chiq (fail-closed default)', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceControlService(prisma as any);
    const status = await svc.getStatus(user);
    expect(status.devices).toHaveLength(2);
    for (const device of status.devices) {
      expect(device.connected).toBe(false);
      for (const c of device.categories) expect(c.enabled).toBe(false);
    }
  });

  it('setPermission — noma\'lum qurilma-turi rad etiladi', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceControlService(prisma as any);
    await expect(svc.setPermission(user, 'toaster', 'files', true)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('setPermission — noma\'lum toifa rad etiladi', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceControlService(prisma as any);
    // Cast ATAYLAB: kompilyator bu qiymatni endi o'zi rad etadi (enum), lekin
    // HTTP'dan kelgan xom matn tip tizimini chetlab o'ta oladi — shuning uchun
    // service ichidagi ISH VAQTI tekshiruvi hamon kerak va shu test uni qo'riqlaydi.
    await expect(
      svc.setPermission(user, 'computer', 'nuclear_launch' as DeviceCategory, true),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('setPermission — yoqilgach getStatus\'da aks etadi va log yoziladi', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceControlService(prisma as any);
    await svc.setPermission(user, 'computer', 'browser', true);
    const status = await svc.getStatus(user);
    const computer = status.devices.find((d) => d.deviceType === 'computer')!;
    expect(computer.categories.find((c) => c.category === 'browser')?.enabled).toBe(true);
    expect(prisma._logs).toHaveLength(1);
    expect(prisma._logs[0].status).toBe('ok');
  });

  it('connect — barcha toifalar uchun o\'chiq yozuv yaratadi (foydalanuvchi keyin yoqadi)', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceControlService(prisma as any);
    await svc.connect(user, 'phone');
    const status = await svc.getStatus(user);
    const phone = status.devices.find((d) => d.deviceType === 'phone')!;
    expect(phone.connected).toBe(true);
    for (const c of phone.categories) expect(c.enabled).toBe(false);
  });

  it('isAllowed — yozuv yo\'q bo\'lsa false (fail-closed)', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceControlService(prisma as any);
    expect(await svc.isAllowed(user.id, 'computer', 'screen')).toBe(false);
  });

  it('isAllowed — yoqilgan toifada true', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceControlService(prisma as any);
    await svc.setPermission(user, 'phone', 'sms', true);
    expect(await svc.isAllowed(user.id, 'phone', 'sms')).toBe(true);
    expect(await svc.isAllowed(user.id, 'phone', 'calls')).toBe(false);
  });

  it('logAction — Prisma yiqilsa ham asosiy oqimni buzmaydi (best-effort)', async () => {
    const prisma = makeMockPrisma();
    prisma.deviceActionLog.create.mockRejectedValueOnce(new Error('db down'));
    const svc = new DeviceControlService(prisma as any);
    await expect(svc.logAction(user.id, { deviceType: 'computer', category: 'files', action: 'x' })).resolves.toBe(
      null,
    );
  });

  it('listActions — limit 200 bilan cheklanadi', async () => {
    const prisma = makeMockPrisma();
    const svc = new DeviceControlService(prisma as any);
    await svc.listActions(user, 500);
    expect(prisma.deviceActionLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
  });
});
