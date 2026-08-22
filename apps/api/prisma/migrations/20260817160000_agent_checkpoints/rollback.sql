-- ORQAGA QAYTARISH — 20260817160000_agent_checkpoints (Rule #27).
--
-- Ishga tushirish:
--   npx prisma db execute --file prisma/migrations/20260817160000_agent_checkpoints/rollback.sql --schema prisma/schema.prisma
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20260817160000_agent_checkpoints';
-- So'ng kodni oldingi commit'ga qaytaring va `npx prisma generate`.
--
-- QAYTA QO'LLASH: migratsiya sof additive va enum YARATMAYDI — `migrate
-- deploy` to'g'ridan-to'g'ri qayta ishlaydi. Yiqilgan urinishdan keyin:
--   npx prisma migrate resolve --rolled-back 20260817160000_agent_checkpoints
--
-- ⚠️ MA'LUMOT YO'QOLISHI — CHEKLANGAN: LangGraph ijro holati o'chadi, ya'ni
-- yarim qolgan ijrolarni AYNAN o'sha joydan davom ettirib bo'lmaydi. Yakunlangan
-- ijrolarga ta'siri YO'Q va foydalanuvchi ma'lumoti (xabarlar, balans, konnektor)
-- bu jadvallarda SAQLANMAYDI.
--
-- BUGUNGI TA'SIR AMALDA NOL: P0-8 oqimga hali ULANMAGAN (`POST /agents/resume`
-- endpointi yo'q, chat oqimi LangGraph grafidan o'tmaydi) — jadvallar deyarli
-- bo'sh. Rollbackdan oldin tekshirish:
--   SELECT count(*) FROM "AgentCheckpoint";
--
-- ⚠️ ENGINE TOMONI: rollbackdan keyin engine `/api/internal/checkpoints` ga
-- borishda 404/500 oladi. Bu XAVFSIZ — `ApiCheckpointSaver` fail-open
-- (xatoni yutadi, ijro davom etadi), lekin loglar shovqinlanadi. Tozalash
-- uchun engine env'iga `AGENT_CHECKPOINTS=off` qo'ying.

DROP TABLE IF EXISTS "AgentCheckpointWrite";

DROP TABLE IF EXISTS "AgentCheckpoint";
