-- CreateTable
CREATE TABLE "ClickTransaction" (
    "id" TEXT NOT NULL,
    "clickTransId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountTiyin" INTEGER NOT NULL,
    "state" INTEGER NOT NULL DEFAULT 0,
    "errorCode" INTEGER,
    "prepareTimeMs" BIGINT,
    "confirmTimeMs" BIGINT,
    "cancelTimeMs" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClickTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClickTransaction_clickTransId_key" ON "ClickTransaction"("clickTransId");

-- CreateIndex
CREATE INDEX "ClickTransaction_userId_idx" ON "ClickTransaction"("userId");

-- CreateIndex
CREATE INDEX "ClickTransaction_state_idx" ON "ClickTransaction"("state");

-- AddForeignKey
ALTER TABLE "ClickTransaction" ADD CONSTRAINT "ClickTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

