import { NotFoundException } from '@nestjs/common';
import { RetailController } from './retail.controller';
import type { User } from '@prisma/client';

const user = { id: 'u1' } as unknown as User;

function makeMock() {
  const retail = {
    listProducts: jest.fn(async () => []),
    upsertProduct: jest.fn(async () => ({})),
    seedDemo: jest.fn(async () => ({})),
    recordSale: jest.fn(async () => ({})),
    listSales: jest.fn(async () => []),
    forecast: jest.fn(async () => ({})),
    reorderPlan: jest.fn(async () => ({})),
    confirmReorderDraft: jest.fn(async () => ({})),
    cancelReorderDraft: jest.fn(async () => ({})),
    ingestVisionEvent: jest.fn(async () => ({})),
    listEvents: jest.fn(async () => []),
    connectCamera: jest.fn(async () => ({})),
    disconnectCamera: jest.fn(async () => ({})),
    cameraStatus: jest.fn(async () => ({})),
    listAlerts: jest.fn(async () => []),
    getSettings: jest.fn(async () => ({})),
    saveSettings: jest.fn(async () => ({})),
  } as any;
  const competitors = {
    listSources: jest.fn(async () => []),
    addSource: jest.fn(async () => ({})),
    removeSource: jest.fn(async () => ({})),
    listChecks: jest.fn(async () => []),
    runCheckForUser: jest.fn(async () => ({})),
  } as any;
  const prisma = { user: { findUnique: jest.fn() } } as any;
  return { retail, competitors, prisma };
}

describe('RetailController — inventar/POS/bashorat parametrlari', () => {
  it('products / upsertProduct / seed', async () => {
    const { retail, competitors, prisma } = makeMock();
    const controller = new RetailController(retail, competitors, prisma);
    const body = { sku: 'MILK1L', name: 'Sut 1L' };

    await controller.products(user);
    await controller.upsertProduct(user, body);
    await controller.seed(user);

    expect(retail.listProducts).toHaveBeenCalledWith(user);
    expect(retail.upsertProduct).toHaveBeenCalledWith(user, body);
    expect(retail.seedDemo).toHaveBeenCalledWith(user);
  });

  it('sale / sales / forecast / reorderPlan', async () => {
    const { retail, competitors, prisma } = makeMock();
    const controller = new RetailController(retail, competitors, prisma);
    const saleBody = { sku: 'MILK1L', qty: 2 };

    await controller.sale(user, saleBody);
    await controller.sales(user);
    await controller.forecast(user);
    await controller.reorderPlan(user);

    expect(retail.recordSale).toHaveBeenCalledWith(user, saleBody);
    expect(retail.listSales).toHaveBeenCalledWith(user);
    expect(retail.forecast).toHaveBeenCalledWith(user);
    expect(retail.reorderPlan).toHaveBeenCalledWith(user);
  });

  it('confirmReorder / cancelReorder', async () => {
    const { retail, competitors, prisma } = makeMock();
    const controller = new RetailController(retail, competitors, prisma);

    await controller.confirmReorder(user, 'draft1');
    await controller.cancelReorder(user, 'draft1');

    expect(retail.confirmReorderDraft).toHaveBeenCalledWith(user, 'draft1');
    expect(retail.cancelReorderDraft).toHaveBeenCalledWith(user, 'draft1');
  });
});

describe('RetailController — raqobatchi narx monitoringi', () => {
  it('competitorSources / addCompetitorSource / removeCompetitorSource / competitorChecks / runCompetitorCheck', async () => {
    const { retail, competitors, prisma } = makeMock();
    const controller = new RetailController(retail, competitors, prisma);
    const sourceBody = { sku: 'MILK1L', name: 'Raqib', url: 'https://raqib.uz' };

    await controller.competitorSources(user);
    await controller.addCompetitorSource(user, sourceBody);
    await controller.removeCompetitorSource(user, 'src1');
    await controller.competitorChecks(user);
    await controller.runCompetitorCheck(user);

    expect(competitors.listSources).toHaveBeenCalledWith(user);
    expect(competitors.addSource).toHaveBeenCalledWith(user, sourceBody);
    expect(competitors.removeSource).toHaveBeenCalledWith(user, 'src1');
    expect(competitors.listChecks).toHaveBeenCalledWith(user);
    expect(competitors.runCheckForUser).toHaveBeenCalledWith(user);
  });
});

describe('RetailController — vision/kamera', () => {
  it("vision — body ?? {} bilan ingestVisionEvent'ni chaqiradi", async () => {
    const { retail, competitors, prisma } = makeMock();
    const controller = new RetailController(retail, competitors, prisma);

    await controller.vision(user, null as any);
    expect(retail.ingestVisionEvent).toHaveBeenCalledWith(user, {});
  });

  it('events / connectCamera / disconnectCamera / cameraStatus', async () => {
    const { retail, competitors, prisma } = makeMock();
    const controller = new RetailController(retail, competitors, prisma);
    const connectBody = { cameraId: 'cam1', rtspUrl: 'rtsp://x' };

    await controller.events(user);
    await controller.connectCamera(user, connectBody);
    await controller.disconnectCamera(user, { cameraId: 'cam1' });
    await controller.cameraStatus(user, 'cam1');

    expect(retail.listEvents).toHaveBeenCalledWith(user);
    expect(retail.connectCamera).toHaveBeenCalledWith(user, connectBody);
    expect(retail.disconnectCamera).toHaveBeenCalledWith(user, 'cam1');
    expect(retail.cameraStatus).toHaveBeenCalledWith(user, 'cam1');
  });
});

describe('RetailController.internalVisionEvent — CV servis (agent-engine) ichki chaqiruvi', () => {
  it("userId bo'yicha foydalanuvchi topilsa -> ingestVisionEvent chaqiriladi", async () => {
    const { retail, competitors, prisma } = makeMock();
    prisma.user.findUnique.mockResolvedValue(user);
    const controller = new RetailController(retail, competitors, prisma);
    const body = { userId: 'u1', camera: 'cam1', type: 'shrinkage', sku: 'MILK1L' };

    await controller.internalVisionEvent(body);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(retail.ingestVisionEvent).toHaveBeenCalledWith(user, body);
  });

  it("mavjud bo'lmagan userId -> NotFoundException, ingestVisionEvent CHAQIRILMAYDI", async () => {
    const { retail, competitors, prisma } = makeMock();
    prisma.user.findUnique.mockResolvedValue(null);
    const controller = new RetailController(retail, competitors, prisma);

    await expect(controller.internalVisionEvent({ userId: 'yoq' })).rejects.toBeInstanceOf(NotFoundException);
    expect(retail.ingestVisionEvent).not.toHaveBeenCalled();
  });
});

describe('RetailController — alerts/settings', () => {
  it('alerts / settings / saveSettings', async () => {
    const { retail, competitors, prisma } = makeMock();
    const controller = new RetailController(retail, competitors, prisma);
    const settingsBody = { alertChannel: 'telegram' };

    await controller.alerts(user);
    await controller.settings(user);
    await controller.saveSettings(user, settingsBody);

    expect(retail.listAlerts).toHaveBeenCalledWith(user);
    expect(retail.getSettings).toHaveBeenCalledWith(user);
    expect(retail.saveSettings).toHaveBeenCalledWith(user, settingsBody);
  });

  it("saveSettings — body null bo'lsa bo'sh obyekt bilan chaqiradi", async () => {
    const { retail, competitors, prisma } = makeMock();
    const controller = new RetailController(retail, competitors, prisma);

    await controller.saveSettings(user, null as any);
    expect(retail.saveSettings).toHaveBeenCalledWith(user, {});
  });
});
