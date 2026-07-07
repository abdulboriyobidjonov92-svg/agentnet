-- CreateTable
CREATE TABLE "ReorderDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "stock" INTEGER NOT NULL,
    "dailyVelocity" DOUBLE PRECISION NOT NULL,
    "daysUntilStockout" DOUBLE PRECISION,
    "orderQty" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReorderDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "manualPrice" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorPriceCheck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "price" INTEGER,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorPriceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReorderDraft_userId_idx" ON "ReorderDraft"("userId");

-- CreateIndex
CREATE INDEX "ReorderDraft_status_idx" ON "ReorderDraft"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReorderDraft_userId_sku_key" ON "ReorderDraft"("userId", "sku");

-- CreateIndex
CREATE INDEX "CompetitorSource_userId_idx" ON "CompetitorSource"("userId");

-- CreateIndex
CREATE INDEX "CompetitorSource_userId_sku_idx" ON "CompetitorSource"("userId", "sku");

-- CreateIndex
CREATE INDEX "CompetitorPriceCheck_userId_idx" ON "CompetitorPriceCheck"("userId");

-- CreateIndex
CREATE INDEX "CompetitorPriceCheck_sourceId_idx" ON "CompetitorPriceCheck"("sourceId");

-- CreateIndex
CREATE INDEX "CompetitorPriceCheck_userId_sku_idx" ON "CompetitorPriceCheck"("userId", "sku");

-- AddForeignKey
ALTER TABLE "ReorderDraft" ADD CONSTRAINT "ReorderDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorSource" ADD CONSTRAINT "CompetitorSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorPriceCheck" ADD CONSTRAINT "CompetitorPriceCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorPriceCheck" ADD CONSTRAINT "CompetitorPriceCheck_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CompetitorSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

