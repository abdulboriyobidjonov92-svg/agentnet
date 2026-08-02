-- CreateTable
CREATE TABLE "DevicePermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevicePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceActionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DevicePermission_userId_idx" ON "DevicePermission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DevicePermission_userId_deviceType_category_key" ON "DevicePermission"("userId", "deviceType", "category");

-- CreateIndex
CREATE INDEX "DeviceActionLog_userId_idx" ON "DeviceActionLog"("userId");

-- CreateIndex
CREATE INDEX "DeviceActionLog_userId_createdAt_idx" ON "DeviceActionLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "DevicePermission" ADD CONSTRAINT "DevicePermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceActionLog" ADD CONSTRAINT "DeviceActionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
