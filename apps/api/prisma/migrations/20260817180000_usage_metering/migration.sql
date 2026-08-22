-- CreateEnum
CREATE TYPE "UsageKind" AS ENUM ('LLM', 'TOOL', 'BROWSER', 'VISION', 'CONNECTOR', 'STORAGE');

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT,
    "runId" TEXT,
    "conversationId" TEXT,
    "kind" "UsageKind" NOT NULL,
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "toolCalls" INTEGER NOT NULL DEFAULT 0,
    "browserMs" INTEGER NOT NULL DEFAULT 0,
    "visionOps" INTEGER NOT NULL DEFAULT 0,
    "connectorCalls" INTEGER NOT NULL DEFAULT 0,
    "executionMs" INTEGER NOT NULL DEFAULT 0,
    "storageBytes" BIGINT NOT NULL DEFAULT 0,
    "internalCostTiyin" BIGINT NOT NULL DEFAULT 0,
    "costUnknown" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageEvent_idempotencyKey_key" ON "UsageEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "UsageEvent_userId_createdAt_idx" ON "UsageEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_agentId_createdAt_idx" ON "UsageEvent"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_runId_idx" ON "UsageEvent"("runId");

-- CreateIndex
CREATE INDEX "UsageEvent_createdAt_idx" ON "UsageEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
