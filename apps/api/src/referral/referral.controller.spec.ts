import { ReferralController } from './referral.controller';
import type { User } from '@prisma/client';

describe('ReferralController.me', () => {
  it("joriy foydalanuvchi bilan ReferralService.getMyReferralInfo'ni chaqiradi", async () => {
    const referral = { getMyReferralInfo: jest.fn(async () => ({ code: 'ABCD1234' })) } as any;
    const controller = new ReferralController(referral);
    const user = { id: 'u1' } as unknown as User;

    const res = await controller.me(user);

    expect(referral.getMyReferralInfo).toHaveBeenCalledWith(user);
    expect(res).toEqual({ code: 'ABCD1234' });
  });
});
