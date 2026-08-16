-- ORQAGA QAYTARISH — 20260815100000_connector_agent_link (Rule #27).
--
-- Ishga tushirish:
--   npx prisma db execute --file prisma/migrations/20260815100000_connector_agent_link/rollback.sql --schema prisma/schema.prisma
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20260815100000_connector_agent_link';
-- So'ng kodni oldingi commit'ga qaytaring va `npx prisma generate`.
--
-- QAYTA QO'LLASH: migratsiya sof additive, enum qo'shmaydi — `prisma migrate
-- deploy` to'g'ridan-to'g'ri ishlaydi. Agar oldingi urinish YIQILGAN bo'lib
-- `_prisma_migrations` da "failed" qator qolgan bo'lsa, avval:
--   npx prisma migrate resolve --rolled-back 20260815100000_connector_agent_link
--
-- DIQQAT — MAʼLUMOT YO'QOLISHI: `ConnectorConfig.agentId` ustuni tashlanadi,
-- yaʼni qaysi konnektor qaysi agentga BIRIKTIRILGANI yo'qoladi. Qatorlarning
-- o'zi (va shifrlangan sirlar) SAQLANADI — faqat biriktirish yo'qoladi va
-- barcha konnektorlar yana "hamma agent uchun" holatiga qaytadi. Rollbackdan
-- OLDIN saqlang:
--   SELECT id, "userId", "connectorId", "agentId" FROM "ConnectorConfig" WHERE "agentId" IS NOT NULL;
--
-- DIQQAT 2 — label konvensiyasi: agentga biriktirilgan qatorlar
-- `label = 'agent:<agentId>'` bilan yozilgan (unique kaliti
-- [userId, connectorId, label] o'zgarmagani uchun). Rollbackdan keyin bu
-- qatorlar 'default' qatoridan ALOHIDA bo'lib qoladi va UI ularni
-- ko'rsatmaydi (UI faqat 'default' bilan ishlaydi) — kerak bo'lsa qo'lda
-- tozalang yoki 'default' ga ko'chiring.

DROP INDEX IF EXISTS "ConnectorConfig_agentId_idx";

ALTER TABLE "ConnectorConfig" DROP CONSTRAINT IF EXISTS "ConnectorConfig_agentId_fkey";

ALTER TABLE "ConnectorConfig" DROP COLUMN IF EXISTS "agentId";
