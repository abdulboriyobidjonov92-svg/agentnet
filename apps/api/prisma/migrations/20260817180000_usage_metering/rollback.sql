-- ORQAGA QAYTARISH — 20260817180000_usage_metering (Rule #27).
--
-- Ishga tushirish:
--   npx prisma db execute --file prisma/migrations/20260817180000_usage_metering/rollback.sql --schema prisma/schema.prisma
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20260817180000_usage_metering';
-- So'ng kodni oldingi commit'ga qaytaring va `npx prisma generate`.
--
-- QAYTA QO'LLASH: `UsageKind` enum'i `CREATE TYPE` bilan yaratiladi —
-- tashlanmasa `migrate deploy` "type already exists" bilan yiqiladi.
-- Yiqilgan urinishdan keyin:
--   npx prisma migrate resolve --rolled-back 20260817180000_usage_metering
--
-- ⚠️ PUL YO'LIGA TA'SIRI YO'Q: `UsageEvent` — bizning ICHKI XARAJATIMIZ
-- o'lchovi (ADR-023 §4), foydalanuvchidan yechilgan pul EMAS. Balans,
-- `CreditLedger` va `CreatorLedger` bu rollbackdan TA'SIRLANMAYDI.
--
-- ⚠️ MA'LUMOT YO'QOLISHI — QAYTARIB BO'LMAYDI: G0.1 (qamrov) va G0.2 (marja)
-- raqamlarining yagona manbai o'chadi. Token/xarajat o'lchovi retroaktiv
-- tiklanmaydi — LLM provayderi o'tmishdagi so'rovlarni qaytarib bermaydi.
-- Ya'ni rollbackdan keyin "bizga qancha turdi?" savoliga javob yo'q.
-- Rollbackdan OLDIN saqlash:
--   \copy (SELECT * FROM "UsageEvent") TO 'usage_event_backup.csv' CSV HEADER
--   -- yoki kunlik yig'indi (yengilroq):
--   \copy (SELECT date_trunc('day',"createdAt") d, kind, model, sum("inputTokens") ti, sum("outputTokens") to_, sum("internalCostTiyin") cost, count(*) n FROM "UsageEvent" GROUP BY 1,2,3) TO 'usage_daily_backup.csv' CSV HEADER

DROP TABLE IF EXISTS "UsageEvent";

DROP TYPE IF EXISTS "UsageKind";
