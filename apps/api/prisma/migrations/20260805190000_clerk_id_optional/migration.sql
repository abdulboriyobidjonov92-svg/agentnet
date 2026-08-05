-- SEC-09: Clerk butunlay olib tashlandi (webhook, @clerk/* paketlar,
-- ClerkGuard/ClerkSyncService — hech qachon haqiqiy autentifikatsiya uchun
-- ishlatilmagan, OTP/dev-login yagona login yo'li bo'lgan). `clerkId` ustuni
-- O'ZI saqlanadi (mavjud foydalanuvchilarda sintetik `dev_...` qiymat bor,
-- @unique cheklovi ham qoladi) — faqat endi MAJBURIY EMAS.
--
-- Sof relaksatsiya (constraint kengaytirish) — ma'lumot yo'qotish xavfi yo'q,
-- mavjud qatorlarning barchasida allaqachon qiymat bor, ular o'zgarishsiz
-- qoladi. `prisma migrate diff` orqali generatsiya qilingan va shadow DB'da
-- tasdiqlangan (offline — sandboxda `migrate dev` interaktiv rejim talab
-- qiladi, ishlamaydi).

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "clerkId" DROP NOT NULL;
