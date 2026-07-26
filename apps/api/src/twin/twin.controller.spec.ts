import { TwinController } from './twin.controller';
import type { User } from '@prisma/client';

const user = { id: 'u1' } as unknown as User;

function makeSvc() {
  return {
    listFacts: jest.fn(async () => []),
    addFact: jest.fn(async () => ({})),
    removeFact: jest.fn(async () => ({})),
    summary: jest.fn(async () => ({})),
    whatIf: jest.fn(async () => ({})),
    extractAndStore: jest.fn(async () => ({})),
  } as any;
}

describe('TwinController — parametrlar to\'g\'ri uzatiladi', () => {
  it('listFacts — user.id bilan chaqiradi', async () => {
    const twin = makeSvc();
    const controller = new TwinController(twin);

    await controller.listFacts(user);
    expect(twin.listFacts).toHaveBeenCalledWith('u1');
  });

  it('addFact — user va dto\'ni uzatadi', async () => {
    const twin = makeSvc();
    const controller = new TwinController(twin);
    const dto = { category: 'work', label: 'Kasb', value: "Do'kon egasi" };

    await controller.addFact(user, dto as any);
    expect(twin.addFact).toHaveBeenCalledWith(user, dto);
  });

  it('removeFact — user va id\'ni uzatadi', async () => {
    const twin = makeSvc();
    const controller = new TwinController(twin);

    await controller.removeFact(user, 'fact-1');
    expect(twin.removeFact).toHaveBeenCalledWith(user, 'fact-1');
  });

  it("summary — user'ni uzatadi", async () => {
    const twin = makeSvc();
    const controller = new TwinController(twin);

    await controller.summary(user);
    expect(twin.summary).toHaveBeenCalledWith(user);
  });

  it('whatIf — dto.question\'ni ajratib uzatadi', async () => {
    const twin = makeSvc();
    const controller = new TwinController(twin);

    await controller.whatIf(user, { question: 'agar men ...bo\'lsa?' } as any);
    expect(twin.whatIf).toHaveBeenCalledWith(user, 'agar men ...bo\'lsa?');
  });

  it("extract — dto.text'ni 'manual' manba bilan uzatadi", async () => {
    const twin = makeSvc();
    const controller = new TwinController(twin);

    await controller.extract(user, { text: 'matn' } as any);
    expect(twin.extractAndStore).toHaveBeenCalledWith(user, 'matn', 'manual');
  });
});
