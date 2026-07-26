import { NotFoundException } from '@nestjs/common';
import { ConnectorsController } from './connectors.controller';
import type { User } from '@prisma/client';

const user = { id: 'u1' } as unknown as User;

function makeMock() {
  const connectors = {
    catalog: jest.fn(async () => []),
    configure: jest.fn(async () => ({})),
    remove: jest.fn(async () => ({ removed: true })),
    invoke: jest.fn(async () => ({ ok: true })),
  } as any;
  const prisma = { user: { findUnique: jest.fn() } } as any;
  return { connectors, prisma };
}

describe('ConnectorsController — foydalanuvchi endpointlari', () => {
  it("publicCatalog — user=null bilan chaqiradi (autentifikatsiyasiz)", async () => {
    const { connectors, prisma } = makeMock();
    const controller = new ConnectorsController(connectors, prisma);

    await controller.publicCatalog();
    expect(connectors.catalog).toHaveBeenCalledWith(null);
  });

  it("myCatalog — joriy user bilan chaqiradi", async () => {
    const { connectors, prisma } = makeMock();
    const controller = new ConnectorsController(connectors, prisma);

    await controller.myCatalog(user);
    expect(connectors.catalog).toHaveBeenCalledWith(user);
  });

  it("configure — body.config berilmasa bo'sh obyekt bilan chaqiradi", async () => {
    const { connectors, prisma } = makeMock();
    const controller = new ConnectorsController(connectors, prisma);

    await controller.configure(user, 'telegram-bot', {} as any);
    expect(connectors.configure).toHaveBeenCalledWith(user, 'telegram-bot', {});
  });

  it("remove — user va connectorId'ni uzatadi", async () => {
    const { connectors, prisma } = makeMock();
    const controller = new ConnectorsController(connectors, prisma);

    await controller.remove(user, 'telegram-bot');
    expect(connectors.remove).toHaveBeenCalledWith(user, 'telegram-bot');
  });

  it("invoke — body.params berilmasa bo'sh obyekt bilan chaqiradi", async () => {
    const { connectors, prisma } = makeMock();
    const controller = new ConnectorsController(connectors, prisma);

    await controller.invoke(user, 'telegram-bot', { action: 'send_message' });
    expect(connectors.invoke).toHaveBeenCalledWith(user, 'telegram-bot', 'send_message', {});
  });
});

describe('ConnectorsController.internalInvoke — engine → API ichki chaqiruvi', () => {
  it("userId bo'yicha foydalanuvchi topilsa -> ConnectorsService.invoke chaqiriladi", async () => {
    const { connectors, prisma } = makeMock();
    prisma.user.findUnique.mockResolvedValue(user);
    const controller = new ConnectorsController(connectors, prisma);

    await controller.internalInvoke({ userId: 'u1', connectorId: 'telegram-bot', action: 'send_message', params: { text: 'hi' } });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(connectors.invoke).toHaveBeenCalledWith(user, 'telegram-bot', 'send_message', { text: 'hi' });
  });

  it("mavjud bo'lmagan userId -> NotFoundException, ConnectorsService.invoke CHAQIRILMAYDI", async () => {
    const { connectors, prisma } = makeMock();
    prisma.user.findUnique.mockResolvedValue(null);
    const controller = new ConnectorsController(connectors, prisma);

    await expect(
      controller.internalInvoke({ userId: 'yoq', connectorId: 'telegram-bot', action: 'send_message' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(connectors.invoke).not.toHaveBeenCalled();
  });
});
