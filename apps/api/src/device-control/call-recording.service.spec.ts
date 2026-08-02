import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CallRecordingService } from './call-recording.service';
import { CryptoService } from '../crypto/crypto.service';
import type { User } from '@prisma/client';

function makeMockPrisma() {
  const rows: any[] = [];
  return {
    _rows: rows,
    callRecording: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `r${rows.length + 1}`, createdAt: new Date(), ...data };
        rows.push(row);
        return row;
      }),
      findMany: jest.fn(async ({ where }: any) => rows.filter((r) => r.userId === where.userId)),
      findFirst: jest.fn(async ({ where }: any) => rows.find((r) => r.id === where.id && r.userId === where.userId) ?? null),
      delete: jest.fn(async ({ where }: any) => {
        const i = rows.findIndex((r) => r.id === where.id);
        if (i >= 0) rows.splice(i, 1);
      }),
    },
  };
}

function makeMockDevice() {
  return { logAction: jest.fn(async () => null) };
}

const user = { id: 'u1' } as unknown as User;
const other = { id: 'u2' } as unknown as User;

describe('CallRecordingService', () => {
  it('create — consentAck bo\'lmasa rad etiladi', async () => {
    const prisma = makeMockPrisma();
    const svc = new CallRecordingService(prisma as any, new CryptoService(), makeMockDevice() as any);
    await expect(
      svc.create(user, { data: 'base64audio', consentAck: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma._rows).toHaveLength(0);
  });

  it('create — audio ma\'lumot yo\'q bo\'lsa rad etiladi', async () => {
    const prisma = makeMockPrisma();
    const svc = new CallRecordingService(prisma as any, new CryptoService(), makeMockDevice() as any);
    await expect(svc.create(user, { data: '', consentAck: true })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create — DB\'da SHIFRLANGAN holda saqlanadi, javobda xom audio yo\'q', async () => {
    const prisma = makeMockPrisma();
    const svc = new CallRecordingService(prisma as any, new CryptoService(), makeMockDevice() as any);
    const res = await svc.create(user, { data: 'xom-audio-baytlari', consentAck: true, durationSec: 12 });
    expect(res).not.toHaveProperty('data');
    expect(prisma._rows[0].data).not.toBe('xom-audio-baytlari');
    expect(prisma._rows[0].data.startsWith('v1:')).toBe(true);
  });

  it('list — boshqa foydalanuvchi yozuvlarini ko\'rmaydi, data maydoni chiqmaydi', async () => {
    const prisma = makeMockPrisma();
    const svc = new CallRecordingService(prisma as any, new CryptoService(), makeMockDevice() as any);
    await svc.create(user, { data: 'a', consentAck: true });
    await svc.create(other, { data: 'b', consentAck: true });
    const list = await svc.list(user);
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty('data');
  });

  it('get — egasi bo\'lsa deshifrlangan audio bilan qaytaradi', async () => {
    const prisma = makeMockPrisma();
    const svc = new CallRecordingService(prisma as any, new CryptoService(), makeMockDevice() as any);
    await svc.create(user, { data: 'sirli-audio', consentAck: true });
    const res = await svc.get(user, prisma._rows[0].id);
    expect(res.data).toBe('sirli-audio');
  });

  it('get — egasi bo\'lmasa 404 (boshqa userning yozuvi ko\'rinmaydi)', async () => {
    const prisma = makeMockPrisma();
    const svc = new CallRecordingService(prisma as any, new CryptoService(), makeMockDevice() as any);
    await svc.create(user, { data: 'a', consentAck: true });
    await expect(svc.get(other, prisma._rows[0].id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove — egasi bo\'lmasa 404, egasi bo\'lsa o\'chiradi va log yozadi', async () => {
    const prisma = makeMockPrisma();
    const device = makeMockDevice();
    const svc = new CallRecordingService(prisma as any, new CryptoService(), device as any);
    await svc.create(user, { data: 'a', consentAck: true });
    const id = prisma._rows[0].id;
    await expect(svc.remove(other, id)).rejects.toBeInstanceOf(NotFoundException);
    await svc.remove(user, id);
    expect(prisma._rows).toHaveLength(0);
    expect(device.logAction).toHaveBeenCalled();
  });
});
