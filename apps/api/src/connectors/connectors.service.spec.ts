import { NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CryptoService } from '../crypto/crypto.service';
import type { ConnectorDefinition, ExecuteContext } from './connector.types';

/**
 * ConnectorsService — S2 SDK'ning yagona ijro nuqtasi. Eng muhim invariantlar:
 *   1. `catalog()` HECH QACHON sir (token/parol) qaytarmaydi — faqat maydon sxemasi.
 *   2. `configure()` sirlarni DB'ga yozishdan OLDIN shifrlaydi (at-rest).
 *   3. `invoke()` deshifrlashni BIR MARTA qiladi va connector'ga ochiq config beradi.
 *   4. `sendViaChannel()` noma'lum kanalni xato bilan rad etadi (yiqilmaydi).
 * Haqiqiy 17 connector implementatsiyasi (tashqi API'lar) o'rniga soxta
 * ConnectorDefinition ishlatiladi — bu servis faqat registryni chaqiradi,
 * har bir connectorni EMAS.
 */

const fakeConnector: ConnectorDefinition = {
  id: 'fake-connector',
  name: 'Fake',
  category: 'messaging',
  description: 'test uchun',
  auth: { type: 'api_key', fields: [{ key: 'apiKey', label: 'API kalit', required: true, secret: true }] },
  actions: [{ id: 'send_message', label: 'Yuborish', description: '', params: [], returns: '' }],
  availability: 'live',
  execute: jest.fn(async (actionId: string, params: any, ctx: ExecuteContext) => ({ ok: true, data: { echo: params, seenConfig: ctx.config } })),
};

const telegramLikeConnector: ConnectorDefinition = {
  ...fakeConnector,
  id: 'telegram-bot',
  execute: jest.fn(async () => ({ ok: true, data: {} })),
};

const fakeById = new Map([
  [fakeConnector.id, fakeConnector],
  [telegramLikeConnector.id, telegramLikeConnector],
]);

jest.mock('./connectors.registry', () => ({
  CONNECTORS: [fakeConnector, telegramLikeConnector],
  connectorById: fakeById,
}));

import { ConnectorsService } from './connectors.service';

function makeMock() {
  const prisma: any = {
    connectorConfig: {
      findMany: jest.fn(async () => []),
      upsert: jest.fn(async (a: any) => ({ id: 'cc1', ...a.create })),
      findUnique: jest.fn(),
      update: jest.fn(async (a: any) => a),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
  };
  const audit = { record: jest.fn(async () => {}) } as any;
  const crypto = new CryptoService(); // haqiqiy — round-trip shifrlashni tekshiradi
  return { prisma, audit, crypto };
}

const user = { id: 'u1' } as unknown as User;

beforeEach(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 32 bayt hex — testlar orasida barqaror
  jest.clearAllMocks();
});

describe('ConnectorsService.catalog — sirlar HECH QACHON qaytmaydi', () => {
  it("auth.fields faqat sxema (key/label/required/secret) — haqiqiy qiymat YO'Q", async () => {
    const { prisma, audit, crypto } = makeMock();
    const svc = new ConnectorsService(prisma, audit, crypto);

    const list = await svc.catalog(user);

    const fake = list.find((c) => c.id === 'fake-connector')!;
    expect(fake.auth.fields).toEqual([{ key: 'apiKey', label: 'API kalit', required: true, secret: true, placeholder: undefined, help: undefined }]);
    expect(fake).not.toHaveProperty('config'); // shifrlangan config obyekti butunlay chiqarilmaydi
  });

  it("ulangan connector 'connected: true', ulanmagan 'not_configured'", async () => {
    const { prisma, audit, crypto } = makeMock();
    prisma.connectorConfig.findMany.mockResolvedValue([
      { connectorId: 'fake-connector', status: 'connected', lastUsedAt: null, lastError: null },
    ]);
    const svc = new ConnectorsService(prisma, audit, crypto);

    const list = await svc.catalog(user);
    expect(list.find((c) => c.id === 'fake-connector')!.connected).toBe(true);
    expect(list.find((c) => c.id === 'telegram-bot')!.status).toBe('not_configured');
  });

  it('user=null (ochiq katalog) -> DB\'ga murojaat qilmaydi, hammasi ulanmagan', async () => {
    const { prisma, audit, crypto } = makeMock();
    const svc = new ConnectorsService(prisma, audit, crypto);

    const list = await svc.catalog(null);
    expect(prisma.connectorConfig.findMany).not.toHaveBeenCalled();
    expect(list.every((c) => !c.connected)).toBe(true);
  });
});

describe('ConnectorsService.configure — shifrlab saqlaydi', () => {
  it("majburiy maydon berilsa -> status='connected', config SHIFRLANGAN holda upsert qilinadi", async () => {
    const { prisma, audit, crypto } = makeMock();
    const svc = new ConnectorsService(prisma, audit, crypto);

    const res = await svc.configure(user, 'fake-connector', { apiKey: 'sir-12345' });

    expect(res.status).toBe('connected');
    expect(res.missing).toEqual([]);
    const savedConfig = prisma.connectorConfig.upsert.mock.calls[0][0].create.config;
    expect(savedConfig).not.toContain('sir-12345'); // plaintext hech qachon DB'ga yozilmaydi
    expect(crypto.decryptJson(savedConfig)).toEqual({ apiKey: 'sir-12345' });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'connector.configure', metadata: expect.objectContaining({ status: 'connected' }) }));
  });

  it("majburiy maydon yetishmasa -> status='needs_credentials' (halol holat, xato YO'Q)", async () => {
    const { prisma, audit, crypto } = makeMock();
    const svc = new ConnectorsService(prisma, audit, crypto);

    const res = await svc.configure(user, 'fake-connector', {});
    expect(res.status).toBe('needs_credentials');
    expect(res.missing).toEqual(['apiKey']);
  });

  it("noma'lum connector -> NotFoundException", async () => {
    const { prisma, audit, crypto } = makeMock();
    const svc = new ConnectorsService(prisma, audit, crypto);

    await expect(svc.configure(user, 'yoq-connector', {})).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ConnectorsService.invoke — deshifrlash bir marta, natija config holatini yangilaydi', () => {
  it("saqlangan (shifrlangan) config'ni deshifrlab connectorga beradi", async () => {
    const { prisma, audit, crypto } = makeMock();
    const encrypted = crypto.encryptJson({ apiKey: 'sir-9999' });
    prisma.connectorConfig.findUnique.mockResolvedValue({ id: 'cc1', config: encrypted });
    const svc = new ConnectorsService(prisma, audit, crypto);

    const res = await svc.invoke(user, 'fake-connector', 'send_message', { text: 'salom' });

    expect((fakeConnector.execute as jest.Mock)).toHaveBeenCalledWith(
      'send_message', { text: 'salom' }, { config: { apiKey: 'sir-9999' }, userId: 'u1' },
    );
    expect(res.ok).toBe(true);
    expect(prisma.connectorConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cc1' }, data: expect.objectContaining({ lastError: null }) }),
    );
  });

  it("config saqlanmagan bo'lsa ham ishlaydi (bo'sh config bilan) — update chaqirilmaydi", async () => {
    const { prisma, audit, crypto } = makeMock();
    prisma.connectorConfig.findUnique.mockResolvedValue(null);
    const svc = new ConnectorsService(prisma, audit, crypto);

    await svc.invoke(user, 'fake-connector', 'send_message', {});
    expect((fakeConnector.execute as jest.Mock)).toHaveBeenCalledWith('send_message', {}, { config: {}, userId: 'u1' });
    expect(prisma.connectorConfig.update).not.toHaveBeenCalled();
  });

  it("natija needs='credentials' bo'lsa -> status 'needs_credentials'ga o'tkaziladi", async () => {
    const { prisma, audit, crypto } = makeMock();
    prisma.connectorConfig.findUnique.mockResolvedValue({ id: 'cc1', config: crypto.encryptJson({}) });
    (fakeConnector.execute as jest.Mock).mockResolvedValueOnce({ ok: false, needs: 'credentials', error: 'yetishmaydi' });
    const svc = new ConnectorsService(prisma, audit, crypto);

    await svc.invoke(user, 'fake-connector', 'send_message', {});
    expect(prisma.connectorConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'needs_credentials', lastError: 'yetishmaydi' }) }),
    );
  });

  it("noma'lum connector -> NotFoundException", async () => {
    const { prisma, audit, crypto } = makeMock();
    const svc = new ConnectorsService(prisma, audit, crypto);

    await expect(svc.invoke(user, 'yoq', 'x', {})).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ConnectorsService.sendViaChannel — kanal → connector xaritalash', () => {
  it("telegram -> telegram-bot.send_message'ga yo'naltiradi", async () => {
    const { prisma, audit, crypto } = makeMock();
    prisma.connectorConfig.findUnique.mockResolvedValue(null);
    const svc = new ConnectorsService(prisma, audit, crypto);

    await svc.sendViaChannel(user, 'telegram', '777', 'salom');
    expect(telegramLikeConnector.execute).toHaveBeenCalledWith('send_message', { chat_id: '777', text: 'salom' }, expect.anything());
  });

  it("noma'lum kanal -> ok:false xato, HECH QANDAY connector chaqirilmaydi", async () => {
    const { prisma, audit, crypto } = makeMock();
    const svc = new ConnectorsService(prisma, audit, crypto);

    const res = await svc.sendViaChannel(user, 'carrier-pigeon', 'x', 'y');
    expect(res).toEqual({ ok: false, error: expect.stringContaining('carrier-pigeon') });
    expect(fakeConnector.execute).not.toHaveBeenCalled();
    expect(telegramLikeConnector.execute).not.toHaveBeenCalled();
  });
});
