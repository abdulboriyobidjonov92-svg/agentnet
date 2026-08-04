-- SEC-05: User.role String -> UserRole enum.
--
-- DIQQAT — bu migratsiya QO'LDA TUZATILGAN. `prisma migrate diff` avtomatik
-- quyidagini generatsiya qiladi:
--     ALTER TABLE "User" DROP COLUMN "role",
--     ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'MEMBER';
-- ya'ni ustunni TASHLAB, qaytadan yaratadi — MAVJUD HAR BIR ROL QIYMATI
-- JIMGINA 'MEMBER'ga tushib qolardi (prod'dagi haqiqiy OWNER'lar ham).
-- Bu — CLAUDE.md Rule #27 ("--accept-data-loss hech qachon") buzilishi.
--
-- Buning o'rniga `USING` cast bilan turni O'ZGARTIRAMIZ — barcha mavjud
-- qiymatlar saqlanadi. Migratsiyadan oldin DB tekshirildi: mavjud yagona
-- qiymatlar 'MEMBER' (10) va 'OWNER' (1) — ikkalasi ham yangi enum'da bor,
-- shuning uchun cast hech qanday satrda yiqilmaydi.
--
-- Agar kelajakda enum'da BO'LMAGAN qiymat DB'da paydo bo'lsa, bu migratsiya
-- ataylab XATO bilan to'xtaydi (jim ma'lumot yo'qotishdan ko'ra yaxshiroq).

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'SUPPORT', 'MEMBER', 'VIEWER');

-- AlterTable: turni o'zgartirish (ma'lumot saqlanadi)
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole" USING "role"::"UserRole";

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
