-- ORQAGA QAYTARISH — 20260807120000_phase3_status_enums (Contract Rule #27:
-- "Har migratsiya orqaga qaytarish rejasi bilan keladi").
--
-- Prisma `down` migratsiyalarni ijro etmaydi; bu fayl QO'LDA ishga tushiriladi:
--   npx prisma db execute --file prisma/migrations/20260807120000_phase3_status_enums/rollback.sql --schema prisma/schema.prisma
-- So'ng `_prisma_migrations` jadvalidan shu migratsiya qatorini o'chiring:
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20260807120000_phase3_status_enums';
-- va `schema.prisma`ni oldingi commit'ga qaytarib `npx prisma generate` qiling.
--
-- MA'LUMOT YO'QOLMAYDI: enum -> text cast har doim muvaffaqiyatli (har bir
-- enum qiymati o'z nomi bilan matnga aylanadi). Ya'ni bu rollback xavfsiz va
-- qaytariladigan.

-- User.platformPlan
ALTER TABLE "User" ALTER COLUMN "platformPlan" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "platformPlan" TYPE TEXT USING "platformPlan"::TEXT;
ALTER TABLE "User" ALTER COLUMN "platformPlan" SET DEFAULT 'none';

-- Agent.frozenReason
ALTER TABLE "Agent" ALTER COLUMN "frozenReason" TYPE TEXT USING "frozenReason"::TEXT;

-- Feedback.status
ALTER TABLE "Feedback" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Feedback" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "Feedback" ALTER COLUMN "status" SET DEFAULT 'new';

-- DevicePermission.category
ALTER TABLE "DevicePermission" ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT;

-- DeviceActionLog.category
ALTER TABLE "DeviceActionLog" ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT;

-- DeviceCommand.kind
ALTER TABLE "DeviceCommand" ALTER COLUMN "kind" TYPE TEXT USING "kind"::TEXT;

-- DeviceCommand.status
ALTER TABLE "DeviceCommand" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "DeviceCommand" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "DeviceCommand" ALTER COLUMN "status" SET DEFAULT 'queued';

-- CreditLedger.kind
ALTER TABLE "CreditLedger" ALTER COLUMN "kind" TYPE TEXT USING "kind"::TEXT;

-- PaymeTransaction.purpose
ALTER TABLE "PaymeTransaction" ALTER COLUMN "purpose" DROP DEFAULT;
ALTER TABLE "PaymeTransaction" ALTER COLUMN "purpose" TYPE TEXT USING "purpose"::TEXT;
ALTER TABLE "PaymeTransaction" ALTER COLUMN "purpose" SET DEFAULT 'topup';

-- ClickTransaction.purpose
ALTER TABLE "ClickTransaction" ALTER COLUMN "purpose" DROP DEFAULT;
ALTER TABLE "ClickTransaction" ALTER COLUMN "purpose" TYPE TEXT USING "purpose"::TEXT;
ALTER TABLE "ClickTransaction" ALTER COLUMN "purpose" SET DEFAULT 'topup';

-- Enum turlarini olib tashlash (ustunlar endi TEXT — bog'liqlik yo'q)
DROP TYPE IF EXISTS "PaymentPurpose";
DROP TYPE IF EXISTS "LedgerKind";
DROP TYPE IF EXISTS "CommandStatus";
DROP TYPE IF EXISTS "CommandKind";
DROP TYPE IF EXISTS "DeviceActionCategory";
DROP TYPE IF EXISTS "DeviceCategory";
DROP TYPE IF EXISTS "FeedbackStatus";
DROP TYPE IF EXISTS "AgentFrozenReason";
DROP TYPE IF EXISTS "PlatformPlan";
