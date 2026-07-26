import { NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { GovtechService } from './govtech.service';
import type { User } from '@prisma/client';

/**
 * GovtechService — murojaat intake/routing (engine tasnifi), timeline
 * qurilishi, va status o'tishlari faqat ruxsat etilgan qiymatlar bilan
 * (halol chegara: jonli davlat tizimiga ulanmagan — routing.live=false).
 */

function makeMock() {
  const prisma: any = {
    citizenRequest: {
      create: jest.fn(async (a: any) => ({ id: 'r1', ...a.data })),
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(),
      update: jest.fn(async (a: any) => a),
    },
  };
  const http = { post: jest.fn(), get: jest.fn() } as any;
  const audit = { record: jest.fn(async () => {}) } as any;
  return { prisma, http, audit };
}

const user = { id: 'u1', preferredLanguage: 'uz' } as unknown as User;

describe('GovtechService.intake', () => {
  it("engine tasnifidan CitizenRequest yaratadi, timeline 'received' + 'routed' bilan boshlanadi", async () => {
    const { prisma, http, audit } = makeMock();
    http.post.mockReturnValue(
      of({ data: { category: 'housing', service: 'propiska', office: '5-mahalla', priority: 'high', method: 'llm', live: false } }),
    );
    const svc = new GovtechService(prisma, http, audit);

    await svc.intake(user, { text: 'Propiska qanday olinadi?', fullName: 'Ali' });

    const data = prisma.citizenRequest.create.mock.calls[0][0].data;
    expect(data.category).toBe('housing');
    expect(data.office).toBe('5-mahalla');
    expect(data.status).toBe('routed');
    expect(data.timeline).toHaveLength(2);
    expect(data.timeline[0].status).toBe('received');
    expect(data.timeline[1].status).toBe('routed');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'govtech.intake', metadata: expect.objectContaining({ category: 'housing', priority: 'high' }) }));
  });

  it("routing.category yo'q bo'lsa -> 'other' ga tushadi", async () => {
    const { prisma, http, audit } = makeMock();
    http.post.mockReturnValue(of({ data: { method: 'heuristic' } }));
    const svc = new GovtechService(prisma, http, audit);

    await svc.intake(user, { text: 'nomalum savol' });
    const data = prisma.citizenRequest.create.mock.calls[0][0].data;
    expect(data.category).toBe('other');
    expect(data.priority).toBe('normal');
  });

  it('engine 422 halal-block bersa -> UnprocessableEntityException, DB yozilmaydi', async () => {
    const { prisma, http, audit } = makeMock();
    http.post.mockReturnValue(
      throwError(() => ({ response: { status: 422, data: { detail: { blocked: true, reason: 'gambling' } } } })),
    );
    const svc = new GovtechService(prisma, http, audit);

    await expect(svc.intake(user, { text: 'kazino ochish uchun ruxsat' })).rejects.toMatchObject({ status: 422 });
    expect(prisma.citizenRequest.create).not.toHaveBeenCalled();
  });

  it('engine mavjud emas -> BadGatewayException', async () => {
    const { prisma, http, audit } = makeMock();
    http.post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
    const svc = new GovtechService(prisma, http, audit);

    await expect(svc.intake(user, { text: 'savol' })).rejects.toMatchObject({ status: 502 });
  });
});

describe('GovtechService.advance', () => {
  it("ruxsat etilgan status -> timeline'ga yangi yozuv qo'shiladi, status yangilanadi", async () => {
    const { prisma, http, audit } = makeMock();
    prisma.citizenRequest.findFirst.mockResolvedValue({
      id: 'r1', userId: 'u1', status: 'routed',
      timeline: [{ at: '2026-01-01T00:00:00Z', status: 'received', note: '' }],
    });
    const svc = new GovtechService(prisma, http, audit);

    await svc.advance(user, 'r1', { status: 'in_progress', note: 'ko\'rib chiqilmoqda' });

    const updateArg = prisma.citizenRequest.update.mock.calls[0][0];
    expect(updateArg.data.status).toBe('in_progress');
    expect(updateArg.data.timeline).toHaveLength(2);
    expect(updateArg.data.timeline[1].note).toBe("ko'rib chiqilmoqda");
  });

  it("ruxsat etilmagan status -> hech narsa o'zgarmaydi, update chaqirilmaydi", async () => {
    const { prisma, http, audit } = makeMock();
    const req = { id: 'r1', userId: 'u1', status: 'routed', timeline: [] };
    prisma.citizenRequest.findFirst.mockResolvedValue(req);
    const svc = new GovtechService(prisma, http, audit);

    const res = await svc.advance(user, 'r1', { status: 'not-a-real-status' });

    expect(res).toBe(req);
    expect(prisma.citizenRequest.update).not.toHaveBeenCalled();
  });

  it("boshqa foydalanuvchining murojaati -> NotFoundException (egalik + mavjudlik bitta so'rovda)", async () => {
    const { prisma, http, audit } = makeMock();
    prisma.citizenRequest.findFirst.mockResolvedValue(null); // findFirst where userId qamraydi
    const svc = new GovtechService(prisma, http, audit);

    await expect(svc.advance(user, 'boshqa-user-ning', { status: 'resolved' })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('GovtechService.catalog — engine o\'chiq bo\'lsa halol bo\'sh natija', () => {
  it('engine javob bersa -> shu ma\'lumotni qaytaradi', async () => {
    const { prisma, http, audit } = makeMock();
    http.get.mockReturnValue(of({ data: { services: ['propiska'], guides: [] } }));
    const svc = new GovtechService(prisma, http, audit);

    await expect(svc.catalog(user)).resolves.toEqual({ services: ['propiska'], guides: [] });
  });

  it("engine mavjud emas -> {services: [], guides: []} (yiqilmaydi)", async () => {
    const { prisma, http, audit } = makeMock();
    http.get.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
    const svc = new GovtechService(prisma, http, audit);

    await expect(svc.catalog(null)).resolves.toEqual({ services: [], guides: [] });
  });
});
