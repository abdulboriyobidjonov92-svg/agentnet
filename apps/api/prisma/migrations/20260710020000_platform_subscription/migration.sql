-- AlterTable
ALTER TABLE "User" ADD COLUMN     "platformPlan" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "platformPlanUntil" TIMESTAMP(3),
ADD COLUMN     "platformPlanFrozen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "platformReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PaymeTransaction" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'topup',
ADD COLUMN     "subscriptionPlan" TEXT;

-- AlterTable
ALTER TABLE "ClickTransaction" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'topup',
ADD COLUMN     "subscriptionPlan" TEXT;
