-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExecutionEventType" AS ENUM ('RUN_STARTED', 'MODEL_STARTED', 'MODEL_COMPLETED', 'TOOL_SELECTED', 'POLICY_CHECK', 'APPROVAL_REQUIRED', 'APPROVAL_GRANTED', 'APPROVAL_DENIED', 'TOOL_STARTED', 'TOOL_RESULT', 'TOOL_FAILED', 'RETRY_STARTED', 'CHECKPOINT_SAVED', 'RUN_COMPLETED', 'RUN_FAILED', 'RUN_CANCELLED');

-- CreateEnum
CREATE TYPE "EventActor" AS ENUM ('system', 'agent', 'user', 'admin');

-- CreateTable
CREATE TABLE "ExecutionRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "conversationId" TEXT,
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "totalCostTiyin" BIGINT NOT NULL DEFAULT 0,
    "stepCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExecutionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepId" TEXT,
    "seq" INTEGER NOT NULL,
    "type" "ExecutionEventType" NOT NULL,
    "actor" "EventActor" NOT NULL,
    "agentId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payload" JSONB,
    "costTiyin" BIGINT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExecutionRun_userId_startedAt_idx" ON "ExecutionRun"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "ExecutionRun_agentId_startedAt_idx" ON "ExecutionRun"("agentId", "startedAt");

-- CreateIndex
CREATE INDEX "ExecutionRun_status_idx" ON "ExecutionRun"("status");

-- CreateIndex
CREATE INDEX "ExecutionEvent_runId_seq_idx" ON "ExecutionEvent"("runId", "seq");

-- CreateIndex
CREATE INDEX "ExecutionEvent_tenantId_createdAt_idx" ON "ExecutionEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionEvent_runId_seq_key" ON "ExecutionEvent"("runId", "seq");

-- AddForeignKey
ALTER TABLE "ExecutionRun" ADD CONSTRAINT "ExecutionRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionRun" ADD CONSTRAINT "ExecutionRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionEvent" ADD CONSTRAINT "ExecutionEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ExecutionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
