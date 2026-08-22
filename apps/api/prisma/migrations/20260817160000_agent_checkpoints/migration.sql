-- CreateTable
CREATE TABLE "AgentCheckpoint" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "checkpointId" TEXT NOT NULL,
    "parentCheckpointId" TEXT,
    "checkpointNs" TEXT NOT NULL DEFAULT '',
    "blob" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCheckpointWrite" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "checkpointNs" TEXT NOT NULL DEFAULT '',
    "checkpointId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "blob" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentCheckpointWrite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentCheckpoint_threadId_checkpointNs_createdAt_idx" ON "AgentCheckpoint"("threadId", "checkpointNs", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCheckpoint_threadId_checkpointNs_checkpointId_key" ON "AgentCheckpoint"("threadId", "checkpointNs", "checkpointId");

-- CreateIndex
CREATE INDEX "AgentCheckpointWrite_threadId_checkpointNs_checkpointId_idx" ON "AgentCheckpointWrite"("threadId", "checkpointNs", "checkpointId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCheckpointWrite_threadId_checkpointNs_checkpointId_tas_key" ON "AgentCheckpointWrite"("threadId", "checkpointNs", "checkpointId", "taskId", "idx");
