import { NotFoundException, UnprocessableEntityException, BadGatewayException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AgentOsService } from './agentos.service';
import type { User } from '@prisma/client';

/**
 * AgentOS — korxona ish maydoni: yaratilganda 5 ta C-suite agenti (Part 1
 * Agent modelida) urug'lanadi, rahbar buyrug'i engine orkestratoriga
 * yuboriladi va natija OrgCommand sifatida saqlanadi. Bu testlar workspace
 * yaratish, buyruq yuborish (muvaffaqiyat/halal-blok/engine-down) va
 * tarixni tekshiradi.
 */

function makeMock() {
  const prisma: any = {
    org: { findUnique: jest.fn(), create: jest.fn() },
    user: { update: jest.fn() },
    agent: { create: jest.fn() },
    orgCommand: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  };
  const http = { post: jest.fn(), get: jest.fn() } as any;
  const audit = { record: jest.fn(async () => {}) } as any;
  return { prisma, http, audit };
}

const user = { id: 'u1', orgId: null, preferredLanguage: 'uz' } as unknown as User;
const userWithOrg = { ...user, orgId: 'org1' } as unknown as User;

describe('AgentOsService.getWorkspace', () => {
  it('orgId yo\'q -> null, DB so\'rov yuborilmaydi', async () => {
    const { prisma, http, audit } = makeMock();
    const svc = new AgentOsService(prisma, http, audit);

    expect(await svc.getWorkspace(user)).toBeNull();
    expect(prisma.org.findUnique).not.toHaveBeenCalled();
  });

  it('orgId bor -> faqat C-suite agentlari bilan org qaytaradi', async () => {
    const { prisma, http, audit } = makeMock();
    prisma.org.findUnique.mockResolvedValue({ id: 'org1', agents: [] });
    const svc = new AgentOsService(prisma, http, audit);

    const res = await svc.getWorkspace(userWithOrg);

    expect(res).toEqual({ id: 'org1', agents: [] });
    expect(prisma.org.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'org1' },
        include: expect.objectContaining({ agents: expect.objectContaining({ where: { csuiteRole: { not: null } } }) }),
      }),
    );
  });
});

describe('AgentOsService.createWorkspace', () => {
  it('org yaratadi, foydalanuvchini org\'ga bog\'laydi (rolga TEGMAYDI) va 5 ta C-suite agentini urug\'laydi', async () => {
    const { prisma, http, audit } = makeMock();
    prisma.org.create.mockResolvedValue({ id: 'org1', name: 'Acme' });
    prisma.org.findUnique.mockResolvedValue({ id: 'org1', agents: [{}, {}, {}, {}, {}] });
    const svc = new AgentOsService(prisma, http, audit);

    await svc.createWorkspace(user, { name: 'Acme' });

    expect(prisma.org.create).toHaveBeenCalled();
    // SEC-05 prerequisite: bu yozuv ilgari `role: 'OWNER'`ni ham o'z ichiga
    // olardi — ya'ni ochiq (faqat ClerkGuard) endpoint orqali o'z-o'zini
    // platforma OWNER'iga ko'tarish. Endi FAQAT orgId yoziladi.
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { orgId: 'org1' },
    });
    expect(prisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: expect.anything() }) }),
    );
    expect(prisma.agent.create).toHaveBeenCalledTimes(5);
    const roles = prisma.agent.create.mock.calls.map((c: any) => c[0].data.csuiteRole).sort();
    expect(roles).toEqual(['ceo', 'cfo', 'clo', 'cmo', 'cto']);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'agentos.workspace_create' }));
  });
});

describe('AgentOsService.runCommand', () => {
  it('ish maydoni mavjud emas -> NotFoundException', async () => {
    const { prisma, http, audit } = makeMock();
    const svc = new AgentOsService(prisma, http, audit);

    await expect(svc.runCommand(user, 'do something')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('muvaffaqiyatli -> orgCommand "running" -> "completed", audit yoziladi', async () => {
    const { prisma, http, audit } = makeMock();
    prisma.org.findUnique.mockResolvedValue({ id: 'org1', name: 'Acme', kind: 'company', agents: [] });
    prisma.orgCommand.create.mockResolvedValue({ id: 'cmd1' });
    prisma.orgCommand.update.mockResolvedValue({ id: 'cmd1', status: 'completed' });
    http.post.mockReturnValue(of({ data: { departments: ['cfo'], method: 'llm' } }));
    const svc = new AgentOsService(prisma, http, audit);

    const res = await svc.runCommand(userWithOrg, 'ship the mvp');

    expect(prisma.orgCommand.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: 'org1', issuedBy: 'u1', command: 'ship the mvp', status: 'running' }),
      }),
    );
    expect(prisma.orgCommand.update).toHaveBeenCalledWith({
      where: { id: 'cmd1' },
      data: { status: 'completed', result: { departments: ['cfo'], method: 'llm' } },
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'agentos.command_run' }));
    expect(res).toEqual({ id: 'cmd1', status: 'completed' });
  });

  it('engine 422 blocked qaytarsa -> UnprocessableEntityException, orgCommand "failed"ga o\'tadi', async () => {
    const { prisma, http, audit } = makeMock();
    prisma.org.findUnique.mockResolvedValue({ id: 'org1', name: 'Acme', kind: 'company', agents: [] });
    prisma.orgCommand.create.mockResolvedValue({ id: 'cmd1' });
    http.post.mockReturnValue(
      throwError(() => ({ response: { status: 422, data: { detail: { blocked: true, reason: 'halal_filter' } } } })),
    );
    const svc = new AgentOsService(prisma, http, audit);

    await expect(svc.runCommand(userWithOrg, 'haram narsa')).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.orgCommand.update).toHaveBeenCalledWith({ where: { id: 'cmd1' }, data: { status: 'failed' } });
  });

  it('engine bilan aloqa yo\'q -> BadGatewayException, orgCommand "failed"ga o\'tadi', async () => {
    const { prisma, http, audit } = makeMock();
    prisma.org.findUnique.mockResolvedValue({ id: 'org1', name: 'Acme', kind: 'company', agents: [] });
    prisma.orgCommand.create.mockResolvedValue({ id: 'cmd1' });
    http.post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
    const svc = new AgentOsService(prisma, http, audit);

    await expect(svc.runCommand(userWithOrg, 'x')).rejects.toBeInstanceOf(BadGatewayException);
    expect(prisma.orgCommand.update).toHaveBeenCalledWith({ where: { id: 'cmd1' }, data: { status: 'failed' } });
  });
});

describe('AgentOsService.history', () => {
  it('orgId yo\'q -> bo\'sh massiv, DB so\'rov yuborilmaydi', async () => {
    const { prisma, http, audit } = makeMock();
    const svc = new AgentOsService(prisma, http, audit);

    expect(await svc.history(user)).toEqual([]);
    expect(prisma.orgCommand.findMany).not.toHaveBeenCalled();
  });

  it('orgId bor -> so\'nggi 20 ta buyruq qaytadi', async () => {
    const { prisma, http, audit } = makeMock();
    prisma.orgCommand.findMany.mockResolvedValue([{ id: 'c1' }]);
    const svc = new AgentOsService(prisma, http, audit);

    const res = await svc.history(userWithOrg);

    expect(res).toEqual([{ id: 'c1' }]);
    expect(prisma.orgCommand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org1' }, take: 20 }),
    );
  });
});

describe('AgentOsService.csuiteCatalog', () => {
  it('engine muvaffaqiyatli javob bersa -> ma\'lumot qaytadi', async () => {
    const { prisma, http, audit } = makeMock();
    http.get.mockReturnValue(of({ data: { roles: ['ceo', 'cfo'] } }));
    const svc = new AgentOsService(prisma, http, audit);

    expect(await svc.csuiteCatalog(user)).toEqual({ roles: ['ceo', 'cfo'] });
  });

  it('engine xato bersa -> bo\'sh roles bilan graceful fallback (throw qilmaydi)', async () => {
    const { prisma, http, audit } = makeMock();
    http.get.mockReturnValue(throwError(() => new Error('down')));
    const svc = new AgentOsService(prisma, http, audit);

    expect(await svc.csuiteCatalog(user)).toEqual({ roles: [] });
  });
});
