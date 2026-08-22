-- ORQAGA QAYTARISH — 20260817120000_execution_trace_events (Rule #27).
--
-- Ishga tushirish:
--   npx prisma db execute --file prisma/migrations/20260817120000_execution_trace_events/rollback.sql --schema prisma/schema.prisma
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20260817120000_execution_trace_events';
-- So'ng kodni oldingi commit'ga qaytaring va `npx prisma generate`.
--
-- ⚠️ TARTIB MUHIM: bu migratsiya P0-6 (20260817140000) va P0-5
-- (20260817180000) dan OLDIN qo'llangan, lekin ular bu jadvallarga FK bilan
-- BOG'LANMAGAN (`ApprovalEvent.runId` va `UsageEvent.runId` — oddiy matn
-- ustunlari, ataylab FK EMAS). Shuning uchun bu rollbackni ular yiqilmasdan
-- alohida bajarish mumkin; ularning `runId` qiymatlari "yetim" bo'lib qoladi.
--
-- QAYTA QO'LLASH: enum'lar `CREATE TYPE` bilan yaratiladi, ya'ni ular
-- tashlanmasa `migrate deploy` "type already exists" bilan yiqiladi —
-- shuning uchun quyida `DROP TYPE` ham bor. Yiqilgan urinishdan keyin:
--   npx prisma migrate resolve --rolled-back 20260817120000_execution_trace_events
--
-- ⚠️ MA'LUMOT YO'QOLISHI — QAYTARIB BO'LMAYDI: butun ijro izi tarixi
-- (`ExecutionRun` + `ExecutionEvent`) o'chadi. Bu "agent qanday ishladi"
-- jurnali; u retroaktiv tiklanmaydi — bugun o'chirilsa, o'sha ijrolar
-- haqidagi ma'lumot butunlay yo'qoladi. `AuditLog` (ADR-008) ALOHIDA
-- jadval va bu rollbackdan TA'SIRLANMAYDI.
-- Rollbackdan OLDIN saqlash:
--   \copy (SELECT * FROM "ExecutionRun") TO 'execution_run_backup.csv' CSV HEADER
--   \copy (SELECT * FROM "ExecutionEvent") TO 'execution_event_backup.csv' CSV HEADER

DROP TABLE IF EXISTS "ExecutionEvent";

DROP TABLE IF EXISTS "ExecutionRun";

DROP TYPE IF EXISTS "ExecutionEventType";

DROP TYPE IF EXISTS "EventActor";

DROP TYPE IF EXISTS "RunStatus";
