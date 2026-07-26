import { NotFoundException } from '@nestjs/common';
import { AutomationController } from './automation.controller';
import type { User } from '@prisma/client';

const user = { id: 'u1', preferredLanguage: 'uz' } as unknown as User;

function makeSvc() {
  const automation = { run: jest.fn(async () => ({})), listRuns: jest.fn(async () => []), capabilities: jest.fn(async () => ({})) } as any;
  const prisma = { user: { findUnique: jest.fn() } } as any;
  return { automation, prisma };
}

describe('AutomationController — foydalanuvchi endpointlari', () => {
  it("run — user, goal, startUrl, language'ni uzatadi", async () => {
    const { automation, prisma } = makeSvc();
    const controller = new AutomationController(automation, prisma);

    await controller.run(user, { goal: 'narxni top', startUrl: 'https://shop.uz', language: 'uz' });
    expect(automation.run).toHaveBeenCalledWith(user, 'narxni top', 'https://shop.uz', 'uz');
  });

  it("list — user'ni uzatadi", async () => {
    const { automation, prisma } = makeSvc();
    const controller = new AutomationController(automation, prisma);

    await controller.list(user);
    expect(automation.listRuns).toHaveBeenCalledWith(user);
  });

  it("capabilities — argumentsiz chaqiradi (autentifikatsiyasiz endpoint)", async () => {
    const { automation, prisma } = makeSvc();
    const controller = new AutomationController(automation, prisma);

    await controller.capabilities();
    expect(automation.capabilities).toHaveBeenCalledWith();
  });
});

describe("AutomationController.internalRun — engine → API ichki chaqiruvi", () => {
  it("userId bo'yicha foydalanuvchi topilsa -> AutomationService.run chaqiriladi", async () => {
    const { automation, prisma } = makeSvc();
    prisma.user.findUnique.mockResolvedValue(user);
    const controller = new AutomationController(automation, prisma);

    await controller.internalRun({ goal: 'maqsad', userId: 'u1', startUrl: 'https://x.uz', language: 'uz' });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(automation.run).toHaveBeenCalledWith(user, 'maqsad', 'https://x.uz', 'uz');
  });

  it("mavjud bo'lmagan userId -> NotFoundException, AutomationService.run CHAQIRILMAYDI", async () => {
    const { automation, prisma } = makeSvc();
    prisma.user.findUnique.mockResolvedValue(null);
    const controller = new AutomationController(automation, prisma);

    await expect(controller.internalRun({ goal: 'maqsad', userId: 'yoq' })).rejects.toBeInstanceOf(NotFoundException);
    expect(automation.run).not.toHaveBeenCalled();
  });
});
