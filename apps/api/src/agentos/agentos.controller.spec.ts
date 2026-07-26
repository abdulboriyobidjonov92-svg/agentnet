import { AgentOsController } from './agentos.controller';
import type { User } from '@prisma/client';

const user = { id: 'u1' } as unknown as User;

function makeSvc() {
  return {
    getWorkspace: jest.fn(async () => ({})),
    createWorkspace: jest.fn(async () => ({})),
    csuiteCatalog: jest.fn(async () => []),
    runCommand: jest.fn(async () => ({})),
    history: jest.fn(async () => []),
  } as any;
}

describe('AgentOsController — parametrlar to\'g\'ri uzatiladi', () => {
  it("workspace — user'ni uzatadi", async () => {
    const agentos = makeSvc();
    const controller = new AgentOsController(agentos);

    await controller.workspace(user);
    expect(agentos.getWorkspace).toHaveBeenCalledWith(user);
  });

  it("create — user va dto'ni uzatadi", async () => {
    const agentos = makeSvc();
    const controller = new AgentOsController(agentos);
    const dto = { name: 'Mening kompaniyam', kind: 'company' };

    await controller.create(user, dto as any);
    expect(agentos.createWorkspace).toHaveBeenCalledWith(user, dto);
  });

  it("csuite — user'ni uzatadi", async () => {
    const agentos = makeSvc();
    const controller = new AgentOsController(agentos);

    await controller.csuite(user);
    expect(agentos.csuiteCatalog).toHaveBeenCalledWith(user);
  });

  it("command — dto.command'ni ajratib uzatadi", async () => {
    const agentos = makeSvc();
    const controller = new AgentOsController(agentos);

    await controller.command(user, { command: 'oylik hisobotni tayyorla' } as any);
    expect(agentos.runCommand).toHaveBeenCalledWith(user, 'oylik hisobotni tayyorla');
  });

  it("history — user'ni uzatadi", async () => {
    const agentos = makeSvc();
    const controller = new AgentOsController(agentos);

    await controller.history(user);
    expect(agentos.history).toHaveBeenCalledWith(user);
  });
});
