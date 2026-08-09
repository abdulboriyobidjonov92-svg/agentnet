import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * SEC-11 — GDPR o'z-o'zini o'chirish xavfsizligi.
 *
 * TOPILGAN BO'SHLIQ (audit): endpoint hech qanday qo'shimcha dalil
 * so'ramasdan hisobni, balansni, agentlarni va suhbatlarni yo'q qilardi —
 * ya'ni O'G'IRLANGAN SESSIYA (OTP fishing / SIM-swap) bir so'rovda hammasini
 * yo'q qila olardi. Bu testlar yopilgan bo'shliqni qulflaydi.
 */

const USER_ID = 'u1';
const CONFIRM = UsersService.expectedDeleteConfirmation(USER_ID);

function makeSvc(over: { twoFactorEnabled?: boolean; totpValid?: boolean; exists?: boolean } = {}) {
  const tx = {
    auditLog: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    conversation: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    agent: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    user: { delete: jest.fn(async () => ({ id: USER_ID })) },
  };
  const prisma = {
    user: {
      findUnique: jest.fn(async () =>
        over.exists === false ? null : { id: USER_ID, twoFactorEnabled: over.twoFactorEnabled ?? true },
      ),
    },
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const twoFactor = { verifyLogin: jest.fn(async () => over.totpValid ?? true) };
  return { svc: new UsersService(prisma as never, twoFactor as never), prisma, tx, twoFactor };
}

describe('DELETE /users/me — yozib tasdiqlash', () => {
  it("noto'g'ri tasdiqlash satri -> rad etiladi, HECH NARSA o'chmaydi", async () => {
    const { svc, tx } = makeSvc();
    await expect(
      svc.deleteAccount(USER_ID, { confirmation: 'DELETE boshqa-id', totp: '123456' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it("mijoz bayrog'i ('true') tasdiq o'rnini BOSMAYDI", async () => {
    const { svc, tx } = makeSvc();
    await expect(
      svc.deleteAccount(USER_ID, { confirmation: 'true', totp: '123456' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it("boshqa foydalanuvchining id'si bilan tasdiq ishlamaydi (satr o'z id'ga bog'langan)", async () => {
    const { svc } = makeSvc();
    await expect(
      svc.deleteAccount(USER_ID, {
        confirmation: UsersService.expectedDeleteConfirmation('boshqa'),
        totp: '123456',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('DELETE /users/me — TOTP qayta-autentifikatsiya', () => {
  it("2FA YOQILGAN, TOTP berilmagan -> rad etiladi (o'g'irlangan sessiya yo'li yopiq)", async () => {
    const { svc, tx } = makeSvc({ twoFactorEnabled: true });
    await expect(svc.deleteAccount(USER_ID, { confirmation: CONFIRM })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it("2FA YOQILGAN, TOTP noto'g'ri -> rad etiladi", async () => {
    const { svc, tx } = makeSvc({ twoFactorEnabled: true, totpValid: false });
    await expect(
      svc.deleteAccount(USER_ID, { confirmation: CONFIRM, totp: '000000' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it("2FA YOQILGAN, TOTP to'g'ri -> o'chiriladi", async () => {
    const { svc, tx, twoFactor } = makeSvc({ twoFactorEnabled: true, totpValid: true });
    await expect(
      svc.deleteAccount(USER_ID, { confirmation: CONFIRM, totp: '123456' }),
    ).resolves.toEqual({ deleted: true });
    expect(twoFactor.verifyLogin).toHaveBeenCalledWith(USER_ID, '123456');
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: USER_ID } });
  });

  it("2FA YOQILMAGAN -> TOTP so'ralmaydi, lekin tasdiqlash SHART", async () => {
    // GDPR huquqi 2FA yoqmaganlarga ham tegishli; himoya darajasi
    // foydalanuvchining o'z auth-sozlamasiga mos.
    const { svc, twoFactor, tx } = makeSvc({ twoFactorEnabled: false });
    await expect(svc.deleteAccount(USER_ID, { confirmation: CONFIRM })).resolves.toEqual({
      deleted: true,
    });
    expect(twoFactor.verifyLogin).not.toHaveBeenCalled();
    expect(tx.user.delete).toHaveBeenCalled();
  });
});

describe('DELETE /users/me — kaskad va yaxlitlik', () => {
  it("hammasi BITTA tranzaksiyada o'chadi (qisman o'chish bo'lmaydi)", async () => {
    const { svc, prisma, tx } = makeSvc({ twoFactorEnabled: false });
    await svc.deleteAccount(USER_ID, { confirmation: CONFIRM });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.deleteMany).toHaveBeenCalledWith({ where: { actorId: USER_ID } });
    expect(tx.conversation.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(tx.agent.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
  });

  it('mavjud bo\'lmagan foydalanuvchi -> NotFound', async () => {
    const { svc } = makeSvc({ exists: false });
    await expect(svc.deleteAccount(USER_ID, { confirmation: CONFIRM })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
