import { of, throwError } from 'rxjs';
import type { User } from '@prisma/client';

/**
 * AutomationService — planner-loop orkestratsiyasi (BrowserBridge to'liq
 * mock qilinadi, haqiqiy Chromium ISHGA TUSHIRILMAYDI). Tekshiriladigan
 * asosiy xatti-harakat: halal-block -> 'blocked' holati, planner o'chiq ->
 * 'failed' (yiqilmaydi), va MAX_STEPS byudjeti tugasa halol to'xtash.
 */

const openMock = jest.fn(async () => {});
const closeMock = jest.fn(async () => {});
const executeMock = jest.fn(async () => 'observation');
const getStateMock = jest.fn(async () => ({ url: 'https://example.com', title: 'Example', text: '', elements: [] }));

jest.mock('./browser-bridge', () => ({
  BrowserBridge: jest.fn().mockImplementation(() => ({
    open: openMock,
    close: closeMock,
    execute: executeMock,
    getState: getStateMock,
  })),
}));

import { AutomationService } from './automation.service';

function makeMock() {
  const prisma: any = {
    automationRun: {
      create: jest.fn(async (a: any) => ({ id: 'run1', ...a.data })),
      update: jest.fn(async (a: any) => ({ id: 'run1', ...a.data })),
      findMany: jest.fn(async () => []),
    },
  };
  const http = { post: jest.fn(), get: jest.fn() } as any;
  const audit = { record: jest.fn(async () => {}) } as any;
  return { prisma, http, audit };
}

const user = { id: 'u1', preferredLanguage: 'uz' } as unknown as User;

beforeEach(() => {
  jest.clearAllMocks();
  openMock.mockResolvedValue(undefined);
  closeMock.mockResolvedValue(undefined);
  executeMock.mockResolvedValue('observation');
  getStateMock.mockResolvedValue({ url: 'https://example.com', title: 'Example', text: '', elements: [] });
});

describe('AutomationService.run', () => {
  it("startUrl berilsa -> avval navigate qadami bajariladi, keyin planner sikli", async () => {
    const { prisma, http, audit } = makeMock();
    http.post.mockReturnValue(of({ data: { action: 'done', method: 'llm', summary: 'Bajarildi', extracted: 'natija' } }));
    const svc = new AutomationService(prisma, http, audit);

    const res: any = await svc.run(user, 'saytga kirib narxni top', 'https://shop.uz');

    expect(executeMock).toHaveBeenCalledWith({ action: 'navigate', url: 'https://shop.uz' });
    expect(openMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1); // finally — har doim yopiladi
    expect(res.status).toBe('completed');
    expect(res.method).toBe('llm');
    expect(res.result.summary).toBe('Bajarildi');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'automation.run', metadata: expect.objectContaining({ status: 'completed' }) }));
  });

  it("plan.summary bo'sh bo'lsa -> alohida /automation/summarize chaqiriladi", async () => {
    const { prisma, http, audit } = makeMock();
    http.post
      .mockReturnValueOnce(of({ data: { action: 'done', method: 'llm', summary: '', extracted: '' } }))
      .mockReturnValueOnce(of({ data: { summary: 'Yig\'ma xulosa' } }));
    const svc = new AutomationService(prisma, http, audit);

    const res: any = await svc.run(user, 'maqsad');

    expect(res.result.summary).toBe("Yig'ma xulosa");
    expect(http.post).toHaveBeenCalledTimes(2);
  });

  it("engine 422 halal-block bersa -> status='blocked', xato tashqariga OTILMAYDI (run() ichida yutiladi)", async () => {
    const { prisma, http, audit } = makeMock();
    http.post.mockReturnValue(
      throwError(() => ({ response: { status: 422, data: { detail: { blocked: true, reason: 'gambling site' } } } })),
    );
    const svc = new AutomationService(prisma, http, audit);

    const res: any = await svc.run(user, 'kazino saytiga kirish');

    expect(res.status).toBe('blocked');
    expect(res.result.summary).toBe('gambling site');
    expect(closeMock).toHaveBeenCalledTimes(1); // brauzer baribir yopiladi
  });

  it("planner umuman ishlamasa (engine o'chiq, 422 emas) -> status='failed', yiqilmaydi", async () => {
    const { prisma, http, audit } = makeMock();
    http.post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
    const svc = new AutomationService(prisma, http, audit);

    const res: any = await svc.run(user, 'maqsad');

    expect(res.status).toBe('failed');
    expect(res.result.summary).toContain('Planner unreachable');
  });

  it("MAX_STEPS (12) tugasa -> halol to'xtaydi ('failed', byudjet xabari), cheksiz aylanmaydi", async () => {
    const { prisma, http, audit } = makeMock();
    // Planner HECH QACHON done/fail demaydi — doim navigate qiladi
    http.post.mockReturnValue(of({ data: { action: 'navigate', url: 'https://example.com/next' } }));
    const svc = new AutomationService(prisma, http, audit);

    const res: any = await svc.run(user, "cheksiz sikl bo'lishi mumkin bo'lgan maqsad");

    expect(res.status).toBe('failed');
    expect(res.result.summary).toContain('Step budget (12) exhausted');
    expect(http.post).toHaveBeenCalledTimes(12);
  });

  it("bridge.execute istisno tashlasa -> status='failed', jarayon yiqilmaydi, brauzer yopiladi", async () => {
    const { prisma, http, audit } = makeMock();
    http.post.mockReturnValue(of({ data: { action: 'click', element_index: 1 } }));
    executeMock.mockRejectedValueOnce(new Error("Element topilmadi"));
    const svc = new AutomationService(prisma, http, audit);

    const res: any = await svc.run(user, 'maqsad');

    expect(res.status).toBe('failed');
    expect(res.result.summary).toContain('Element topilmadi');
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});

describe('AutomationService.listRuns', () => {
  it("foydalanuvchi bo'yicha eng so'nggi 20 tani beradi", async () => {
    const { prisma, http, audit } = makeMock();
    const svc = new AutomationService(prisma, http, audit);

    await svc.listRuns(user);

    expect(prisma.automationRun.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  });
});

describe('AutomationService.capabilities', () => {
  it('engine javob bersa -> shu ma\'lumotni qaytaradi', async () => {
    const { prisma, http, audit } = makeMock();
    http.get.mockReturnValue(of({ data: { tier: 1, scope: 'browser automation' } }));
    const svc = new AutomationService(prisma, http, audit);

    await expect(svc.capabilities()).resolves.toEqual({ tier: 1, scope: 'browser automation' });
  });

  it("engine o'chiq bo'lsa -> halol fallback (yiqilmaydi)", async () => {
    const { prisma, http, audit } = makeMock();
    http.get.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
    const svc = new AutomationService(prisma, http, audit);

    await expect(svc.capabilities()).resolves.toEqual({ tier: 1, scope: 'browser automation', note: 'engine offline' });
  });
});
