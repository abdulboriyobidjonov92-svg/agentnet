-- ORQAGA QAYTARISH — 20260817140000_policy_and_kill_switch (Rule #27).
--
-- Ishga tushirish:
--   npx prisma db execute --file prisma/migrations/20260817140000_policy_and_kill_switch/rollback.sql --schema prisma/schema.prisma
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20260817140000_policy_and_kill_switch';
-- So'ng kodni oldingi commit'ga qaytaring va `npx prisma generate`.
--
-- QAYTA QO'LLASH: ikkita enum `CREATE TYPE` bilan yaratiladi — tashlanmasa
-- `migrate deploy` "type already exists" bilan yiqiladi. Yiqilgan urinishdan
-- keyin: npx prisma migrate resolve --rolled-back 20260817140000_policy_and_kill_switch
--
-- ⚠️⚠️ XAVFSIZLIK OGOHLANTIRISHI — TO'XTATILGAN AGENTLAR QAYTA ISHGA
-- TUSHADI. `Agent.killedAt` ustuni tashlanadi, ya'ni STOP bosilgan yoki
-- admin tomonidan global kill qilingan HAR BIR agent yana faol holatga
-- qaytadi. Kod eski commit'ga qaytarilgani uchun kill switch tekshiruvi
-- ham yo'qoladi. Rollbackdan OLDIN ro'yxatni oling va agentlarni QO'LDA
-- pauza qiling (`Agent.status`):
--   SELECT id, "userId", "killedAt", "killReason" FROM "Agent" WHERE "killedAt" IS NOT NULL;
--
-- ⚠️ MA'LUMOT YO'QOLISHI — QAYTARIB BO'LMAYDIGAN AKTIV: `ApprovalEvent`
-- shunchaki jurnal EMAS — bu "inson qaysi amalni tasdiqladi / rad etdi /
-- TUZATDI" korpusi (MASTER_ROADMAP §2 M3, retention 365 kun). `modifiedAction`
-- maydonini hech qanday tashqi manbadan sotib olib bo'lmaydi va u retroaktiv
-- yig'ilmaydi. Rollbackdan OLDIN saqlash SHART:
--   \copy (SELECT * FROM "ApprovalEvent") TO 'approval_event_backup.csv' CSV HEADER

DROP TABLE IF EXISTS "ApprovalEvent";

ALTER TABLE "Agent" DROP COLUMN IF EXISTS "killReason";

ALTER TABLE "Agent" DROP COLUMN IF EXISTS "killedAt";

ALTER TABLE "Agent" DROP COLUMN IF EXISTS "killedById";

DROP TYPE IF EXISTS "ApprovalDecision";

DROP TYPE IF EXISTS "RiskTier";
