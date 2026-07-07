-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "originalCreatorId" TEXT;

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "originalCreatorId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "bonusAmountTiyin" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payout_originalCreatorId_idx" ON "Payout"("originalCreatorId");

-- CreateIndex
CREATE INDEX "Payout_buyerId_idx" ON "Payout"("buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_agentId_buyerId_key" ON "Payout"("agentId", "buyerId");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_originalCreatorId_fkey" FOREIGN KEY ("originalCreatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

