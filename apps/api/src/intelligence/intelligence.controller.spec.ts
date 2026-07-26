import { IntelligenceController } from './intelligence.controller';
import type { User } from '@prisma/client';

const user = { id: 'u1' } as unknown as User;

function makeSvc() {
  return {
    fusion: jest.fn(async () => ({})),
    fusionRoles: jest.fn(async () => []),
    ethicsEvaluate: jest.fn(async () => ({})),
    knowledgeSearch: jest.fn(async () => ({})),
    superMode: jest.fn(async () => ({})),
  } as any;
}

describe('IntelligenceController — parametrlar to\'g\'ri uzatiladi', () => {
  it("fusion — dto.roles berilmasa bo'sh ro'yxat bilan chaqiradi", async () => {
    const intelligence = makeSvc();
    const controller = new IntelligenceController(intelligence);

    await controller.fusion(user, { problem: 'Savdo pasaydi, nima qilish kerak?' } as any);
    expect(intelligence.fusion).toHaveBeenCalledWith(user, 'Savdo pasaydi, nima qilish kerak?', []);
  });

  it('fusion — dto.roles berilsa uzatadi', async () => {
    const intelligence = makeSvc();
    const controller = new IntelligenceController(intelligence);

    await controller.fusion(user, { problem: 'muammo', roles: ['ceo', 'cfo'] } as any);
    expect(intelligence.fusion).toHaveBeenCalledWith(user, 'muammo', ['ceo', 'cfo']);
  });

  it('fusionRoles — user\'ni uzatadi', async () => {
    const intelligence = makeSvc();
    const controller = new IntelligenceController(intelligence);

    await controller.fusionRoles(user);
    expect(intelligence.fusionRoles).toHaveBeenCalledWith(user);
  });

  it('ethics — dto.action\'ni ajratib uzatadi', async () => {
    const intelligence = makeSvc();
    const controller = new IntelligenceController(intelligence);

    await controller.ethics(user, { action: 'mijozdan pul yashirish' } as any);
    expect(intelligence.ethicsEvaluate).toHaveBeenCalledWith(user, 'mijozdan pul yashirish');
  });

  it("knowledge — dto.query'ni ajratib uzatadi", async () => {
    const intelligence = makeSvc();
    const controller = new IntelligenceController(intelligence);

    await controller.knowledge(user, { query: 'soliq stavkasi' } as any);
    expect(intelligence.knowledgeSearch).toHaveBeenCalledWith(user, 'soliq stavkasi');
  });

  it("superMode — dto.command'ni ajratib uzatadi", async () => {
    const intelligence = makeSvc();
    const controller = new IntelligenceController(intelligence);

    await controller.superMode(user, { command: 'haftalik hisobotni tayyorla' } as any);
    expect(intelligence.superMode).toHaveBeenCalledWith(user, 'haftalik hisobotni tayyorla');
  });
});
