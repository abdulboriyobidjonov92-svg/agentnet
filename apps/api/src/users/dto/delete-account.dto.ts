import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

/**
 * SEC-11 (o'z-o'zini o'chirish) — GDPR hisobni o'chirish tasdiqlash.
 *
 * NEGA §6.5 oqimi TO'LIQ QO'LLANMAYDI (ataylab):
 *   • §6.5 — ADMIN xavfli amallari uchun (boshqa odam ustidan amal).
 *     O'z-o'zini o'chirish — foydalanuvchining GDPR HUQUQI.
 *   • "Sabab (min 20 belgi)" TALAB QILINMAYDI: GDPR bo'yicha o'chirishni
 *     o'zini oqlashga majburlab bo'lmaydi.
 *   • "24 soatlik kechikish" TALAB QILINMAYDI: Contract §6.5(5) uni FAQAT
 *     admin o'chirishi uchun belgilaydi; GDPR esa tez o'chirishni yoqlaydi.
 *   • "OWNER Telegram signali" TALAB QILINMAYDI: bu admin nazorati uchun.
 *
 * NIMA TALAB QILINADI (va NEGA): o'g'irlangan sessiya bilan hisobni butunlay
 * yo'q qilib bo'lmasligi SHART. Shuning uchun:
 *   1. TOTP qayta-autentifikatsiya — 2FA YOQILGAN bo'lsa MAJBURIY;
 *   2. yozib tasdiqlash (`DELETE <o'z-id>`) — tasodifiy/CSRF-uslubidagi
 *      chaqiruvni to'sadi va niyatni aniq qiladi.
 */
export class DeleteAccountDto {
  /**
   * §6.5(3) naqshi: `DELETE <userId>`. Server kutilgan satrni O'ZI
   * hisoblaydi — mijozdan kelgan bayroqqa ishonilmaydi.
   */
  @IsString()
  @MaxLength(200)
  confirmation: string;

  /**
   * TOTP kodi. 2FA yoqilgan foydalanuvchi uchun MAJBURIY (server tekshiradi);
   * 2FA yoqilmaganlar uchun berilmaydi.
   */
  @IsOptional()
  @IsString()
  @Length(6, 6, { message: "TOTP kodi 6 xonali bo'lishi shart" })
  totp?: string;
}
