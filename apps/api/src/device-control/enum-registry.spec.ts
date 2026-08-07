import { CommandKind, DeviceCategory, PlatformPlan } from '@prisma/client';
import { DEVICE_CATEGORIES } from './device-control.service';
import { PLATFORM_PLANS } from '../billing/platform-billing.service';

/**
 * Phase 3 / Contract A14 — kod ichidagi REGISTRLAR va DB enum'lari ayrilib
 * ketmasligini qulflaydi.
 *
 * NEGA BU TEST BOR: aynan shu drift jonli kodda TOPILDI. `schema.prisma`
 * izohi `platformPlan` domenini `none | pro | max | enterprise` deb yozgan
 * edi, `PLATFORM_PLANS` esa `max200` ni ham sotardi ($200 tarif, o'z narxi
 * va kunlik limiti bilan). Enum shu izohga qarab yozilganda `max200`
 * sotib olgan foydalanuvchi migratsiyani YIQITARDI.
 *
 * Endi registr va enum bir-birini tekshiradi — izoh emas, KOD manba.
 */

describe('A14 — registr/enum mosligi', () => {
  it('DEVICE_CATEGORIES dagi har toifa `DeviceCategory` enum ichida', () => {
    const known = new Set<string>(Object.values(DeviceCategory));
    const used = new Set<string>(Object.values(DEVICE_CATEGORIES).flat());

    for (const category of used) {
      expect(known.has(category)).toBe(true);
    }
  });

  it('`DeviceCategory` enum ortiqcha (ishlatilmaydigan) qiymat saqlamaydi', () => {
    // Ikki tomonlama: enum ham registrdan oshib ketmasligi kerak, aks holda
    // DB "mumkin" deydigan, lekin mahsulot bilmaydigan toifa paydo bo'ladi.
    const used = new Set<string>(Object.values(DEVICE_CATEGORIES).flat());
    for (const category of Object.values(DeviceCategory)) {
      expect(used.has(category)).toBe(true);
    }
  });

  it('sotiladigan har platforma tarifi (`PLATFORM_PLANS`) `PlatformPlan` enum ichida', () => {
    const known = new Set<string>(Object.values(PlatformPlan));
    for (const plan of PLATFORM_PLANS) {
      expect(known.has(plan)).toBe(true);
    }
  });

  it("`PlatformPlan` self-serve bo'lmagan qiymatlarni ham qamraydi (none, enterprise)", () => {
    // `none` — default, `enterprise` — kelishuv asosida (o'z-o'zidan sotilmaydi),
    // shuning uchun ular `PLATFORM_PLANS` da YO'Q, lekin DB'da bo'lishi SHART.
    expect(Object.values(PlatformPlan)).toEqual(
      expect.arrayContaining(['none', 'enterprise']),
    );
  });

  it('`CommandKind` enum qiymatlari buyruq registrida to\'liq qoplangan', () => {
    // `COMMAND_RULES` eksport qilinmagan (ichki registr), shuning uchun uni
    // bilvosita tekshiramiz: enum'dagi har bir buyruq turi mahsulotda
    // ma'no kasb etishi kerak — ro'yxat qo'lda emas, enum'dan olinadi.
    expect(Object.values(CommandKind).sort()).toEqual(
      ['call', 'computer_use', 'open_app', 'send_sms'].sort(),
    );
  });
});
