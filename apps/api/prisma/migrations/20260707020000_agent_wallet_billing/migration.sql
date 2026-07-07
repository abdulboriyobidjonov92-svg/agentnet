-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "chargeRetries" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "creationPriceTiyin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "frozen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monthlyPriceTiyin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nextChargeAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CreditLedger" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedger_idempotencyKey_key" ON "CreditLedger"("idempotencyKey");

