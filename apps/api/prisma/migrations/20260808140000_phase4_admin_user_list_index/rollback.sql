-- ORQAGA QAYTARISH — 20260808140000_phase4_admin_user_list_index (Rule #27).
--
-- Ishga tushirish:
--   npx prisma db execute --file prisma/migrations/20260808140000_phase4_admin_user_list_index/rollback.sql --schema prisma/schema.prisma
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20260808140000_phase4_admin_user_list_index';
--
-- MA'LUMOTGA TA'SIR QILMAYDI: indeks tashlash faqat tezlikni qaytaradi,
-- bironta qator o'zgarmaydi.

DROP INDEX IF EXISTS "Feedback_createdAt_idx";
DROP INDEX IF EXISTS "Feedback_status_createdAt_idx";
DROP INDEX IF EXISTS "User_createdAt_idx";
