-- AlterTable
ALTER TABLE "Agent" ALTER COLUMN "model" SET DEFAULT 'claude-sonnet-5';

-- CreateTable
CREATE TABLE "BrowserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "label" TEXT,
    "state" TEXT NOT NULL,
    "cookieCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrowserSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrowserSession_userId_idx" ON "BrowserSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BrowserSession_userId_domain_key" ON "BrowserSession"("userId", "domain");

-- AddForeignKey
ALTER TABLE "BrowserSession" ADD CONSTRAINT "BrowserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
