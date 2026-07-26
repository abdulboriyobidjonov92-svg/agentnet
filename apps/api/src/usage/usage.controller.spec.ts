import { UsageController } from './usage.controller';
import type { User } from '@prisma/client';

const user = { id: 'u1' } as unknown as User;

describe('UsageController', () => {
  it("status — joriy foydalanuvchi bilan UsageService.status'ni chaqiradi", () => {
    const usage = { status: jest.fn(() => ({ remaining: 10 })), consumeChat: jest.fn() } as any;
    const controller = new UsageController(usage);

    expect(controller.status(user)).toEqual({ remaining: 10 });
    expect(usage.status).toHaveBeenCalledWith(user);
  });

  it("consumeChat — joriy foydalanuvchi bilan UsageService.consumeChat'ni chaqiradi", async () => {
    const usage = { status: jest.fn(), consumeChat: jest.fn(async () => ({ remaining: 9 })) } as any;
    const controller = new UsageController(usage);

    const res = await controller.consumeChat(user);

    expect(usage.consumeChat).toHaveBeenCalledWith(user);
    expect(res).toEqual({ remaining: 9 });
  });
});
