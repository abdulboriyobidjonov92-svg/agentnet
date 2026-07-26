import { GoalsController } from './goals.controller';
import type { User } from '@prisma/client';

const user = { id: 'u1' } as unknown as User;

function makeSvc() {
  return {
    create: jest.fn(async () => ({})),
    findAll: jest.fn(async () => []),
    findOne: jest.fn(async () => ({})),
    advance: jest.fn(async () => ({})),
    remove: jest.fn(async () => undefined),
  } as any;
}

describe('GoalsController — parametrlar to\'g\'ri uzatiladi', () => {
  it('create — user va dto.title\'ni uzatadi', async () => {
    const goals = makeSvc();
    const controller = new GoalsController(goals);

    await controller.create(user, { title: 'Savdoni oshirish' } as any);
    expect(goals.create).toHaveBeenCalledWith(user, 'Savdoni oshirish');
  });

  it("findAll — user'ni uzatadi", async () => {
    const goals = makeSvc();
    const controller = new GoalsController(goals);

    await controller.findAll(user);
    expect(goals.findAll).toHaveBeenCalledWith(user);
  });

  it('findOne — id va user\'ni (shu tartibda) uzatadi', async () => {
    const goals = makeSvc();
    const controller = new GoalsController(goals);

    await controller.findOne(user, 'g1');
    expect(goals.findOne).toHaveBeenCalledWith('g1', user);
  });

  it("advance — id va user'ni uzatadi", async () => {
    const goals = makeSvc();
    const controller = new GoalsController(goals);

    await controller.advance(user, 'g1');
    expect(goals.advance).toHaveBeenCalledWith('g1', user);
  });

  it("remove — id va user'ni uzatadi", async () => {
    const goals = makeSvc();
    const controller = new GoalsController(goals);

    await controller.remove(user, 'g1');
    expect(goals.remove).toHaveBeenCalledWith('g1', user);
  });
});
