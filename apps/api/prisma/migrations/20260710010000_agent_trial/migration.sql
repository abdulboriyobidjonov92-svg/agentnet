-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "frozenReason" TEXT,
ADD COLUMN     "isTrialAgent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trialStartedAt" TIMESTAMP(3),
ADD COLUMN     "trialMessageCount" INTEGER NOT NULL DEFAULT 0;
