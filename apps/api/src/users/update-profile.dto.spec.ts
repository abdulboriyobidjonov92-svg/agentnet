import { ValidationPipe } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * SEC-05 prerequisite — mass-assignment regressiya testi.
 *
 * Bu test `main.ts`dagi global pipe bilan AYNAN bir xil sozlama
 * (`whitelist: true, transform: true`) ostida ishlaydi, ya'ni haqiqiy
 * ishlab-chiqarish xulqini takrorlaydi.
 *
 * Nima uchun kerak: ilgari `PATCH /users/me` `@Body()`ni class-validator
 * metadatasi BO'LMAGAN inline tip bilan qabul qilardi. `whitelist: true`
 * bunday holatda hech narsani filtrlamaydi — natijada xom body Prisma
 * `data`ga yoyilib, `role`/`balanceTiyin` kabi himoyalangan ustunlar
 * yozilardi (jonli tasdiqlangan). Bu test shu regressiyani qaytib
 * kelishidan saqlaydi.
 */
describe('UpdateProfileDto — mass-assignment himoyasi (SEC-05 prerequisite)', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const meta = { type: 'body' as const, metatype: UpdateProfileDto };

  it("himoyalangan maydonlar (role, balanceTiyin, plan, tokenVersion) JIMGINA olib tashlanadi", async () => {
    const out = await pipe.transform(
      {
        name: 'Halol Foydalanuvchi',
        role: 'OWNER',
        balanceTiyin: 999999999,
        plan: 'pro',
        tokenVersion: 42,
        platformPlan: 'enterprise',
      },
      meta,
    );

    expect(out).toEqual({ name: 'Halol Foydalanuvchi' });
    expect(out).not.toHaveProperty('role');
    expect(out).not.toHaveProperty('balanceTiyin');
    expect(out).not.toHaveProperty('plan');
    expect(out).not.toHaveProperty('tokenVersion');
    expect(out).not.toHaveProperty('platformPlan');
  });

  it("ruxsat etilgan to'rtta maydon o'tadi", async () => {
    const out = await pipe.transform(
      { isBusinessAccount: true, name: 'Ism', tourCompleted: true, briefingOptIn: false },
      meta,
    );

    expect(out).toEqual({
      isBusinessAccount: true,
      name: 'Ism',
      tourCompleted: true,
      briefingOptIn: false,
    });
  });

  it("faqat himoyalangan maydonlar yuborilsa — natija BO'SH obyekt (hech narsa yozilmaydi)", async () => {
    const out = await pipe.transform({ role: 'OWNER', balanceTiyin: 1 }, meta);
    expect(out).toEqual({});
  });
});
