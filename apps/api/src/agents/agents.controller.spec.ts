import { AgentsController } from './agents.controller';
import type { User } from '@prisma/client';

const user = { id: 'u1' } as unknown as User;

function makeSvc() {
  return {
    compose: jest.fn(async () => ({})),
    create: jest.fn(async () => ({})),
    findAll: jest.fn(async () => []),
    findOne: jest.fn(async () => ({})),
    update: jest.fn(async () => ({})),
    remove: jest.fn(async () => undefined),
    run: jest.fn(async () => ({})),
    reactivate: jest.fn(async () => ({})),
    trustLog: jest.fn(async () => []),
  } as any;
}

describe('AgentsController — parametrlar to\'g\'ri uzatiladi', () => {
  it("compose — user, description va language'ni uzatadi", async () => {
    const agents = makeSvc();
    const controller = new AgentsController(agents);

    await controller.compose(user, { description: "Do'kon uchun yordamchi kerak", language: 'uz' } as any);
    expect(agents.compose).toHaveBeenCalledWith(user, "Do'kon uchun yordamchi kerak", 'uz');
  });

  it("create — user va dto'ni uzatadi", async () => {
    const agents = makeSvc();
    const controller = new AgentsController(agents);
    const dto = { name: 'Agent', systemPrompt: 'p', toolsConfig: [] };

    await controller.create(user, dto as any);
    expect(agents.create).toHaveBeenCalledWith(user, dto);
  });

  it("findAll — user'ni uzatadi", async () => {
    const agents = makeSvc();
    const controller = new AgentsController(agents);

    await controller.findAll(user);
    expect(agents.findAll).toHaveBeenCalledWith(user);
  });

  it("findOne — id va user'ni uzatadi", async () => {
    const agents = makeSvc();
    const controller = new AgentsController(agents);

    await controller.findOne(user, 'a1');
    expect(agents.findOne).toHaveBeenCalledWith('a1', user);
  });

  it("update — id, user va dto'ni uzatadi", async () => {
    const agents = makeSvc();
    const controller = new AgentsController(agents);
    const dto = { name: 'Yangi nom' };

    await controller.update(user, 'a1', dto as any);
    expect(agents.update).toHaveBeenCalledWith('a1', user, dto);
  });

  it("remove — id va user'ni uzatadi", async () => {
    const agents = makeSvc();
    const controller = new AgentsController(agents);

    await controller.remove(user, 'a1');
    expect(agents.remove).toHaveBeenCalledWith('a1', user);
  });

  it("run — id, user, message va conversationId'ni uzatadi", async () => {
    const agents = makeSvc();
    const controller = new AgentsController(agents);

    await controller.run(user, 'a1', { message: 'savol', conversationId: 'c1' });
    expect(agents.run).toHaveBeenCalledWith('a1', user, 'savol', 'c1');
  });

  it("reactivate — id va user'ni uzatadi", async () => {
    const agents = makeSvc();
    const controller = new AgentsController(agents);

    await controller.reactivate(user, 'a1');
    expect(agents.reactivate).toHaveBeenCalledWith('a1', user);
  });

  it("trustLog — id va user'ni uzatadi", async () => {
    const agents = makeSvc();
    const controller = new AgentsController(agents);

    await controller.trustLog(user, 'a1');
    expect(agents.trustLog).toHaveBeenCalledWith('a1', user);
  });
});
