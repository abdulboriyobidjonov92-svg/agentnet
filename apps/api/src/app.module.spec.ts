import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

/**
 * BOOT TESTI — butun DI grafigi haqiqatan yig'iladimi?
 *
 * NEGA BU TEST BOR (SEC-13 davomida topilgan regressiya):
 * SEC-12 `AuthGuard`ga uchinchi bog'liqlik (`ImpersonationService`)
 * qo'shdi. 19 ta modul esa `AuthGuard`ni O'Z providers ro'yxatida
 * saqlab kelayotgan edi (SEC-05 Option B dan qolgan o'lik meros —
 * `@UseGuards(AuthGuard)` chaqiruv-nuqtasi allaqachon nol edi). Natijada
 * Nest boot'da yiqilardi:
 *   "Nest can't resolve dependencies of the AuthGuard ... in the
 *    ReferralModule context"
 *
 * Buni HECH BIR mavjud tekshiruv ushlamadi: birlik testlari guard'ni
 * `new AuthGuard(...)` bilan qo'lda yasaydi, `tsc` va `nest build` esa
 * faqat kompilyatsiya qiladi — DI grafigi ish vaqtida yig'iladi.
 * Shu sabab bu yerda AYNAN o'sha bosqich sinaladi.
 *
 * DB ULANMAYDI: `PrismaService` mock bilan almashtiriladi — test
 * deterministik bo'lishi va CI'da Postgres talab qilmasligi shart.
 * Tekshirilayotgan narsa — provayderlar grafigi, ma'lumot emas.
 */
describe('AppModule — DI grafigi', () => {
  it('butun ilova moduli xatosiz yig\'iladi (barcha guard/provider hal bo\'ladi)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(async () => undefined),
        $disconnect: jest.fn(async () => undefined),
        $on: jest.fn(),
      })
      .compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  }, 60_000);
});
