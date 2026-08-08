-- ORQAGA QAYTARISH — 20260808130000_phase3_drop_user_deleted_at
-- (Contract Rule #27).
--
-- Ishga tushirish:
--   npx prisma db execute --file prisma/migrations/20260808130000_phase3_drop_user_deleted_at/rollback.sql --schema prisma/schema.prisma
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20260808130000_phase3_drop_user_deleted_at';
-- So'ng kodni oldingi commit'ga qaytaring va `npx prisma generate`.
--
-- Ustun nullable va BO'SH holda tashlangani uchun tiklash ma'lumot talab
-- qilmaydi — qayta yaratilgan ustun asl holicha (barcha qatorlarda NULL)
-- bo'ladi, ya'ni rollback to'liq va yo'qotishsiz.

ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
