import { ShareController } from './share.controller';
import type { User } from '@prisma/client';

const user = { id: 'u1' } as unknown as User;

describe('ShareController', () => {
  it("create — user va body'ni uzatadi (faqat autentifikatsiyalangan)", async () => {
    const share = { create: jest.fn(async () => ({ token: 'tok' })), getPublic: jest.fn() } as any;
    const controller = new ShareController(share);
    const body = { title: 'Bashorat', kind: 'retail_forecast' as const };

    const res = await controller.create(user, body as any);

    expect(share.create).toHaveBeenCalledWith(user, body);
    expect(res).toEqual({ token: 'tok' });
  });

  it("getPublic — faqat token bilan chaqiradi (PUBLIC, guardsiz)", async () => {
    const share = { create: jest.fn(), getPublic: jest.fn(async () => ({ title: 'Bashorat' })) } as any;
    const controller = new ShareController(share);

    const res = await controller.getPublic('tok-123');

    expect(share.getPublic).toHaveBeenCalledWith('tok-123');
    expect(res).toEqual({ title: 'Bashorat' });
  });
});
