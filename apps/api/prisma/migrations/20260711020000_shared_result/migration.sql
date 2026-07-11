-- CreateTable
CREATE TABLE "SharedResult" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'generic',
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "metrics" JSONB,
    "body" TEXT,
    "locale" TEXT DEFAULT 'uz',
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedResult_token_key" ON "SharedResult"("token");

-- CreateIndex
CREATE INDEX "SharedResult_ownerId_idx" ON "SharedResult"("ownerId");

-- AddForeignKey
ALTER TABLE "SharedResult" ADD CONSTRAINT "SharedResult_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
