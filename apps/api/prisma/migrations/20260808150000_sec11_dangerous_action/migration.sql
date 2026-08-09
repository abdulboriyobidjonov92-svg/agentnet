-- SEC-11 §6.5 — xavfli admin amallari uchun DAVOMLI holat.
--
-- NEGA JADVAL: §6.5 "bekor qilish oynasi"ni talab qiladi — amal so'ralgan
-- payt bilan bajarilgan payt ORASIDA holat bo'lishi shart. Xotirada saqlash
-- ko'p instansda ishlamaydi (Contract A19/§8) va restartda yo'qoladi.
--
-- HOLAT MASHINASI: pending -> executed | cancelled | expired. Boshqa o'tish
-- yo'q; o'tishlar server tomonda (shartli UPDATE bilan) majburlanadi.
--
-- DIQQAT — bu migratsiya QO'LDA YOZILGAN. `prisma migrate diff` avtomatik
-- ravishda `DROP TABLE "AuditLogHashBackup"` ni ham qo'shdi: u jadval A17
-- migratsiyasi tomonidan XOM SQL bilan yaratilgan va ATAYLAB Prisma
-- sxemasida yo'q (u — audit-zanjir rechain'ining rollback to'ri, o'z
-- runbook'i bo'yicha alohida tashlanadi). Uni bu yerga qo'shish bog'liq
-- bo'lmagan DESTRUKTIV amal bo'lardi, shuning uchun OLIB TASHLANDI.
--
-- Faqat qo'shuvchi (additive) o'zgarishlar — mavjud ma'lumotga tegilmaydi.
-- Orqaga qaytarish: shu papkadagi `rollback.sql`.

-- CreateEnum
CREATE TYPE "DangerousActionKind" AS ENUM ('role_assign', 'session_revoke');

-- CreateEnum
CREATE TYPE "DangerousActionStatus" AS ENUM ('pending', 'executed', 'cancelled', 'expired');

-- CreateTable
CREATE TABLE "DangerousAction" (
    "id" TEXT NOT NULL,
    "kind" "DangerousActionKind" NOT NULL,
    "status" "DangerousActionStatus" NOT NULL DEFAULT 'pending',
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "payload" JSONB,
    "executableAfter" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DangerousAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DangerousAction_status_expiresAt_idx" ON "DangerousAction"("status", "expiresAt");
CREATE INDEX "DangerousAction_targetUserId_idx" ON "DangerousAction"("targetUserId");
CREATE INDEX "DangerousAction_actorId_createdAt_idx" ON "DangerousAction"("actorId", "createdAt");

-- AddForeignKey: aktor Restrict — xavfli-amal tarixi aktor bilan birga
-- jimgina yo'qolmasligi kerak (auditga tegishli yozuv).
ALTER TABLE "DangerousAction" ADD CONSTRAINT "DangerousAction_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: nishon o'chirilsa (GDPR) unga qaratilgan xavfli amallar
-- ham ketadi — ular endi ma'nosiz va shaxsiy ma'lumotga ishora qiladi.
ALTER TABLE "DangerousAction" ADD CONSTRAINT "DangerousAction_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
