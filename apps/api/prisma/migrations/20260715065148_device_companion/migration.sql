-- CreateTable
CREATE TABLE "DeviceCompanion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT,
    "pairingCode" TEXT,
    "tokenHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pairedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceCompanion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCommand" (
    "id" TEXT NOT NULL,
    "companionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCompanion_pairingCode_key" ON "DeviceCompanion"("pairingCode");

-- CreateIndex
CREATE INDEX "DeviceCompanion_userId_idx" ON "DeviceCompanion"("userId");

-- CreateIndex
CREATE INDEX "DeviceCommand_companionId_status_idx" ON "DeviceCommand"("companionId", "status");

-- CreateIndex
CREATE INDEX "DeviceCommand_userId_idx" ON "DeviceCommand"("userId");

-- AddForeignKey
ALTER TABLE "DeviceCompanion" ADD CONSTRAINT "DeviceCompanion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCommand" ADD CONSTRAINT "DeviceCommand_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "DeviceCompanion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCommand" ADD CONSTRAINT "DeviceCommand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
