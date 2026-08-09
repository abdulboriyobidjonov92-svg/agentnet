-- ORQAGA QAYTARISH — 20260809220000_sec12_impersonation_and_user_write_actions (Rule #27).
--
-- Ishga tushirish:
--   npx prisma db execute --file prisma/migrations/20260809220000_sec12_impersonation_and_user_write_actions/rollback.sql --schema prisma/schema.prisma
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20260809220000_sec12_impersonation_and_user_write_actions';
-- So'ng kodni oldingi commit'ga qaytaring va `npx prisma generate`.
--
-- QAYTA QO'LLASH (mashq yoki oldinga siljish): migratsiyadagi
-- `ALTER TYPE ... ADD VALUE IF NOT EXISTS` tufayli `prisma migrate deploy`
-- to'g'ridan-to'g'ri ishlaydi. Agar oldingi urinish YIQILGAN bo'lib
-- `_prisma_migrations` da "failed" qator qolgan bo'lsa, avval:
--   npx prisma migrate resolve --rolled-back 20260809220000_sec12_impersonation_and_user_write_actions
--
-- DIQQAT 1 — MA'LUMOT YO'QOLISHI: `ImpersonationSession` jadvali va
-- `User.blocked*` ustunlari tashlanadi. Ya'ni qaysi hisoblar BLOKLANGANI
-- yo'qoladi (bloklangan foydalanuvchilar qaytadan kira oladi). Rollbackdan
-- OLDIN `SELECT id, "blockedAt", "blockedReason" FROM "User" WHERE
-- "blockedAt" IS NOT NULL;` natijasini saqlang.
--
-- DIQQAT 2 — AUDIT SAQLANADI: impersonation hodisalari (`impersonation.*`)
-- `AuditLog` da qoladi va zanjir buzilmaydi — `impersonatedUserId` ustuni
-- kanonik hash kirishida YO'Q, buzilmas nusxa `metadata` ichida. Ya'ni
-- rollback forensik izni yo'qotmaydi.
--
-- DIQQAT 3 — ENUM QIYMATLARI TASHLANMAYDI: PostgreSQL `ALTER TYPE ... DROP
-- VALUE` ni QO'LLAB-QUVVATLAMAYDI. `DangerousActionKind` dagi uchta yangi
-- qiymat va `LedgerKind.admin_credit` bazada QOLADI. Bu xavfsiz: ular hech
-- qanday qatorda ishlatilmagan bo'lsa (rollback shartlaridan biri), eski
-- kod ularni hech qachon yozmaydi. Agar ular ALLAQACHON ishlatilgan bo'lsa
-- (bajarilgan qo'lda kredit / blok), avval o'sha qatorlarni ko'rib chiqing —
-- `SELECT * FROM "CreditLedger" WHERE kind = 'admin_credit';`
-- `SELECT * FROM "DangerousAction" WHERE kind IN ('credit_manual','user_block','user_unblock');`

DROP INDEX IF EXISTS "User_blockedAt_idx";
DROP INDEX IF EXISTS "AuditLog_impersonatedUserId_seq_idx";

ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "impersonatedUserId";

ALTER TABLE "User" DROP COLUMN IF EXISTS "blockedAt";
ALTER TABLE "User" DROP COLUMN IF EXISTS "blockedReason";
ALTER TABLE "User" DROP COLUMN IF EXISTS "blockedById";

DROP TABLE IF EXISTS "ImpersonationSession";
DROP TYPE IF EXISTS "ImpersonationStatus";
DROP TYPE IF EXISTS "ImpersonationMode";
