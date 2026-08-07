-- Phase 3 / Contract A14 (ADR-009): holat/tur maydonlari String -> enum.
--
-- DIQQAT — bu migratsiya QO'LDA YOZILGAN (SEC-05'dagi `user_role_enum` bilan
-- bir xil sabab). `prisma migrate dev` avtomatik quyidagini taklif qildi:
--     "The `status` column on the `DeviceCommand` table would be dropped and
--      recreated. This will lead to data loss."
-- ya'ni ustunlarni TASHLAB qaytadan yaratardi va HAR BIR mavjud qiymat
-- default'ga tushib qolardi (jonli buyruq/fikr/obuna holatlari yo'qolardi).
-- Bu — Rule #27 ("--accept-data-loss hech qachon") buzilishi.
--
-- Buning o'rniga `USING` cast bilan TURNI o'zgartiramiz — barcha qiymatlar
-- saqlanadi. Agar DB'da enum'da BO'LMAGAN qiymat bo'lsa, migratsiya ataylab
-- XATO bilan to'xtaydi (Postgres DDL tranzaksion — hech narsa o'zgarmaydi),
-- chunki jim ma'lumot buzilishidan ko'ra to'xtagan deploy yaxshiroq.
--
-- MIGRATSIYADAN OLDIN jonli baza tekshirildi (mavjud qiymatlar):
--   User.platformPlan          none(19)   [domen: none|pro|max|max200|enterprise —
--                              `max200` sxema izohida YO'Q edi, PLATFORM_PLANS
--                              (platform-billing.service.ts) dan topildi]
--   Agent.frozenReason         NULL(14)
--   Feedback.status            new(2)
--   DevicePermission.category  apps, screen, browser, sms, files
--   DeviceActionLog.category   connect(9), browser, screen, sms, files, apps, calls
--   DeviceCommand.kind         send_sms(1)
--   DeviceCommand.status       done(1)
--   CreditLedger.kind          agent_creation(4), usage(3), refund(3)
--   Payme/ClickTransaction.purpose  (jadvallar bo'sh)
-- Hammasi quyidagi enum'lar ichida — cast hech bir satrda yiqilmaydi.
--
-- PROD'GA CHIQARISHDAN OLDIN shu tekshiruvni prod nusxasida qayting
-- (docs/runbooks/phase3-enum-migration.md).
--
-- Orqaga qaytarish: shu papkadagi `rollback.sql`.

-- CreateEnum
CREATE TYPE "PlatformPlan" AS ENUM ('none', 'pro', 'max', 'max200', 'enterprise');
CREATE TYPE "AgentFrozenReason" AS ENUM ('trial_expired', 'monthly_payment_failed');
CREATE TYPE "FeedbackStatus" AS ENUM ('new', 'seen', 'resolved');
CREATE TYPE "DeviceCategory" AS ENUM ('browser', 'files', 'apps', 'screen', 'calls', 'sms');
CREATE TYPE "DeviceActionCategory" AS ENUM ('browser', 'files', 'apps', 'screen', 'calls', 'sms', 'connect');
CREATE TYPE "CommandKind" AS ENUM ('send_sms', 'call', 'open_app', 'computer_use');
CREATE TYPE "CommandStatus" AS ENUM ('queued', 'running', 'done', 'failed', 'denied');
CREATE TYPE "LedgerKind" AS ENUM ('topup', 'usage', 'refund', 'subscription', 'agent_creation', 'agent_monthly', 'marketplace_install', 'creator_bonus', 'referral_bonus');
CREATE TYPE "PaymentPurpose" AS ENUM ('topup', 'platform_subscription');

-- AlterTable: User.platformPlan (default bor -> avval DROP, keyin SET)
ALTER TABLE "User" ALTER COLUMN "platformPlan" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "platformPlan" TYPE "PlatformPlan" USING "platformPlan"::"PlatformPlan";
ALTER TABLE "User" ALTER COLUMN "platformPlan" SET DEFAULT 'none';

-- AlterTable: Agent.frozenReason (nullable, default yo'q)
ALTER TABLE "Agent"
  ALTER COLUMN "frozenReason" TYPE "AgentFrozenReason" USING "frozenReason"::"AgentFrozenReason";

-- AlterTable: Feedback.status
ALTER TABLE "Feedback" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Feedback"
  ALTER COLUMN "status" TYPE "FeedbackStatus" USING "status"::"FeedbackStatus";
ALTER TABLE "Feedback" ALTER COLUMN "status" SET DEFAULT 'new';

-- AlterTable: DevicePermission.category
ALTER TABLE "DevicePermission"
  ALTER COLUMN "category" TYPE "DeviceCategory" USING "category"::"DeviceCategory";

-- AlterTable: DeviceActionLog.category (ruxsat-toifalari + `connect`)
ALTER TABLE "DeviceActionLog"
  ALTER COLUMN "category" TYPE "DeviceActionCategory" USING "category"::"DeviceActionCategory";

-- AlterTable: DeviceCommand.kind
ALTER TABLE "DeviceCommand"
  ALTER COLUMN "kind" TYPE "CommandKind" USING "kind"::"CommandKind";

-- AlterTable: DeviceCommand.status
ALTER TABLE "DeviceCommand" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "DeviceCommand"
  ALTER COLUMN "status" TYPE "CommandStatus" USING "status"::"CommandStatus";
ALTER TABLE "DeviceCommand" ALTER COLUMN "status" SET DEFAULT 'queued';

-- AlterTable: CreditLedger.kind (PUL YO'LI — qiymatlar saqlanishi kritik)
ALTER TABLE "CreditLedger"
  ALTER COLUMN "kind" TYPE "LedgerKind" USING "kind"::"LedgerKind";

-- AlterTable: PaymeTransaction.purpose
ALTER TABLE "PaymeTransaction" ALTER COLUMN "purpose" DROP DEFAULT;
ALTER TABLE "PaymeTransaction"
  ALTER COLUMN "purpose" TYPE "PaymentPurpose" USING "purpose"::"PaymentPurpose";
ALTER TABLE "PaymeTransaction" ALTER COLUMN "purpose" SET DEFAULT 'topup';

-- AlterTable: ClickTransaction.purpose
ALTER TABLE "ClickTransaction" ALTER COLUMN "purpose" DROP DEFAULT;
ALTER TABLE "ClickTransaction"
  ALTER COLUMN "purpose" TYPE "PaymentPurpose" USING "purpose"::"PaymentPurpose";
ALTER TABLE "ClickTransaction" ALTER COLUMN "purpose" SET DEFAULT 'topup';
