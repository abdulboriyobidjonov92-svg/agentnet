-- SEC-12 §6.6 — impersonation + Users yozish amallari (qo'lda kredit, blok).
--
-- Uch guruh o'zgarish, HAMMASI ADDITIVE (mavjud ma'lumotga tegilmaydi):
--   1. `ImpersonationSession` jadvali + `ImpersonationMode`/`Status` enumlari
--      — impersonation sessiyasining SERVER TOMONIDAGI haqiqati (JWT unga
--      faqat havola qiladi; bekor qilish imzolangan token bilan mumkin emas).
--   2. `AuditLog.impersonatedUserId` — "admin uning nomidan qildi" ni
--      "foydalanuvchi o'zi qildi" dan ajratadigan ustun (ADR-008).
--      KANONIK HASH O'ZGARMAYDI: bu ustun `computeEntryHash` kirishida yo'q,
--      buzilmas nusxa `metadata.impersonatedUserId` da (hash ichida) yashaydi.
--   3. `User.blockedAt/blockedReason/blockedById` + `LedgerKind.admin_credit`
--      + uchta yangi `DangerousActionKind` — Users yozish amallari SEC-11
--      xavfli-amal oqimidan o'tadi (ikkinchi tasdiqlash mexanizmi yo'q).
--
-- DIQQAT — bu migratsiya QO'LDA TAHRIRLANGAN (SEC-11 dagi bilan bir xil
-- sabab). `prisma migrate diff` avtomatik ravishda
-- `DROP TABLE "AuditLogHashBackup"` ni ham qo'shdi: u jadval A17
-- migratsiyasi tomonidan xom SQL bilan yaratilgan va ATAYLAB Prisma
-- sxemasida yo'q (audit-zanjir rechain'ining rollback to'ri; o'z runbook'i
-- bo'yicha alohida tashlanadi, hozir 36 qator bor). Uni bu yerga qo'shish
-- SEC-12 ga aloqasiz DESTRUKTIV amal bo'lardi — OLIB TASHLANDI.
--
-- Orqaga qaytarish: shu papkadagi `rollback.sql`.

-- CreateEnum
CREATE TYPE "ImpersonationMode" AS ENUM ('READ_ONLY');

-- CreateEnum
CREATE TYPE "ImpersonationStatus" AS ENUM ('active', 'ended', 'expired');

-- AlterEnum
-- Bir migratsiyada bittadan ortiq enum qiymati qo'shilmoqda — PostgreSQL 12+
-- da bu tranzaksiya ichida ishlaydi (qiymat SHU migratsiyada ISHLATILMAYDI,
-- shuning uchun "unsafe use of new value" xatosi yuzaga kelmaydi).
--
-- `IF NOT EXISTS` ATAYLAB (Prisma generatori uni qo'shmaydi): PostgreSQL
-- `ALTER TYPE ... DROP VALUE` ni qo'llab-quvvatlamaydi, ya'ni `rollback.sql`
-- bu qiymatlarni OLIB TASHLAY OLMAYDI. Usiz "apply -> rollback -> re-apply"
-- mashqi `enum label already exists` bilan yiqilardi — ya'ni migratsiya
-- amalda qaytarib bo'lmaydigan bo'lib qolardi (Rule #27 buni talab qiladi).
ALTER TYPE "DangerousActionKind" ADD VALUE IF NOT EXISTS 'credit_manual';
ALTER TYPE "DangerousActionKind" ADD VALUE IF NOT EXISTS 'user_block';
ALTER TYPE "DangerousActionKind" ADD VALUE IF NOT EXISTS 'user_unblock';

-- AlterEnum
ALTER TYPE "LedgerKind" ADD VALUE IF NOT EXISTS 'admin_credit';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "impersonatedUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "blockedAt" TIMESTAMP(3),
ADD COLUMN     "blockedById" TEXT,
ADD COLUMN     "blockedReason" TEXT;

-- CreateTable
CREATE TABLE "ImpersonationSession" (
    "id" TEXT NOT NULL,
    "status" "ImpersonationStatus" NOT NULL DEFAULT 'active',
    "mode" "ImpersonationMode" NOT NULL DEFAULT 'READ_ONLY',
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorTokenVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endedReason" TEXT,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpersonationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImpersonationSession_actorId_createdAt_idx" ON "ImpersonationSession"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ImpersonationSession_targetUserId_createdAt_idx" ON "ImpersonationSession"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ImpersonationSession_status_expiresAt_idx" ON "ImpersonationSession"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_impersonatedUserId_seq_idx" ON "AuditLog"("impersonatedUserId", "seq");

-- CreateIndex
CREATE INDEX "User_blockedAt_idx" ON "User"("blockedAt");

-- AddForeignKey: aktor Restrict — impersonation tarixi operator o'chirilsa
-- jimgina yo'qolmasligi kerak (nazorat yozuvi).
ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: nishon o'chirilsa (GDPR) uning hisobiga qaratilgan
-- sessiyalar ham ketadi — ular shaxsiy ma'lumotga ishora qiladi.
ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
