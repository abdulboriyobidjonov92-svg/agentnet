-- AlterTable
ALTER TABLE "User" ADD COLUMN     "briefingOptIn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastBriefingAt" TIMESTAMP(3);
