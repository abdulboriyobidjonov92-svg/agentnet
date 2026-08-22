-- CreateEnum
CREATE TYPE "RiskTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'MODIFIED');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "killReason" TEXT,
ADD COLUMN     "killedAt" TIMESTAMP(3),
ADD COLUMN     "killedById" TEXT;

-- CreateTable
CREATE TABLE "ApprovalEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepId" TEXT,
    "actionId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "riskTier" "RiskTier" NOT NULL,
    "proposedAction" JSONB NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "modifiedAction" JSONB,
    "latencyMs" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalEvent_userId_createdAt_idx" ON "ApprovalEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalEvent_agentId_createdAt_idx" ON "ApprovalEvent"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalEvent_runId_idx" ON "ApprovalEvent"("runId");

-- AddForeignKey
ALTER TABLE "ApprovalEvent" ADD CONSTRAINT "ApprovalEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
