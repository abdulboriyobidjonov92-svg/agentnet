import { ForbiddenException } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';
import type { User } from '@prisma/client';

/**
 * FeedbackController — `assertAdmin` (faqat OWNER) list/setStatus'ni
 * himoya qiladi. Bu servis EMAS, CONTROLLER'ning o'zida yashaydigan
 * avtorizatsiya — shu sabab alohida testga loyiq.
 */

function makeSvc() {
  return {
    submit: jest.fn(async () => ({})),
    list: jest.fn(async () => []),
    setStatus: jest.fn(async () => ({})),
  } as any;
}

const owner = { id: 'admin', role: 'OWNER' } as unknown as User;
const member = { id: 'u1', role: 'MEMBER' } as unknown as User;

describe('FeedbackController.submit — istalgan foydalanuvchi yubora oladi', () => {
  it("user va dto'ni uzatadi", async () => {
    const feedback = makeSvc();
    const controller = new FeedbackController(feedback);
    const dto = { message: 'Yaxshi mahsulot!' };

    await controller.submit(member, dto as any);
    expect(feedback.submit).toHaveBeenCalledWith(member, dto);
  });
});

describe("FeedbackController.list — FAQAT OWNER", () => {
  it("OWNER bo'lmagan (MEMBER) -> ForbiddenException, FeedbackService.list CHAQIRILMAYDI", async () => {
    const feedback = makeSvc();
    const controller = new FeedbackController(feedback);

    expect(() => controller.list(member, undefined)).toThrow(ForbiddenException);
    expect(feedback.list).not.toHaveBeenCalled();
  });

  it("OWNER -> ruxsat, limit string'i Number'ga aylantiriladi", () => {
    const feedback = makeSvc();
    const controller = new FeedbackController(feedback);

    controller.list(owner, '25');
    expect(feedback.list).toHaveBeenCalledWith(25);
  });

  it("limit berilmasa -> undefined uzatiladi (servis o'z standartini ishlatadi)", () => {
    const feedback = makeSvc();
    const controller = new FeedbackController(feedback);

    controller.list(owner, undefined);
    expect(feedback.list).toHaveBeenCalledWith(undefined);
  });
});

describe("FeedbackController.setStatus — FAQAT OWNER", () => {
  it("OWNER bo'lmagan -> ForbiddenException, FeedbackService.setStatus CHAQIRILMAYDI", () => {
    const feedback = makeSvc();
    const controller = new FeedbackController(feedback);

    expect(() => controller.setStatus(member, 'f1', { status: 'resolved' })).toThrow(ForbiddenException);
    expect(feedback.setStatus).not.toHaveBeenCalled();
  });

  it("OWNER -> id va status'ni uzatadi", () => {
    const feedback = makeSvc();
    const controller = new FeedbackController(feedback);

    controller.setStatus(owner, 'f1', { status: 'seen' });
    expect(feedback.setStatus).toHaveBeenCalledWith('f1', 'seen');
  });
});
