-- ORQAGA QAYTARISH — 20260807130000_phase3_list_composite_indexes
-- (Contract Rule #27: har migratsiya orqaga qaytarish rejasi bilan keladi).
--
-- Ishga tushirish:
--   npx prisma db execute --file prisma/migrations/20260807130000_phase3_list_composite_indexes/rollback.sql --schema prisma/schema.prisma
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20260807130000_phase3_list_composite_indexes';
--
-- MA'LUMOTGA TA'SIR QILMAYDI: indeks tashlash faqat tezlikni qaytaradi,
-- bironta qator o'zgarmaydi. Ya'ni bu rollback butunlay xavfsiz.

DROP INDEX IF EXISTS "CreditLedger_userId_createdAt_idx";
DROP INDEX IF EXISTS "Conversation_userId_updatedAt_idx";
DROP INDEX IF EXISTS "Agent_userId_createdAt_idx";
