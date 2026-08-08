-- Phase 3 / Contract A15 (`deletedAt` soft delete — Status: REMOVE).
--
-- SABAB (Contract + ARCHITECTURAL_AUDIT §7.2): ustun mavjud, lekin HECH
-- QAYERDA filtrlanmaydi — ya'ni "o'chirilgan" foydalanuvchi baribir barcha
-- so'rovlarga tushardi. Yarim joriy etilgan soft-delete — ma'lumot sizishining
-- klassik manbai ("unutilgan filtr"). Contract qarori: soft-delete BUTUNLAY
-- olib tashlanadi; yagona yo'l — GDPR hard-delete + `AuditLog` yozuvi
-- (`users.service.deleteAccount()` allaqachon shunday ishlaydi).
--
-- XAVFSIZLIK: kod-bazada 0 ta o'quvchi/yozuvchi (repo bo'ylab qidiruv bilan
-- tasdiqlangan — faqat sxema va init-migratsiyada uchraydi). Jonli bazada
-- ustun BO'SH (19 qatordan 0 tasi to'ldirilgan), ya'ni ma'lumot yo'qolmaydi.
--
-- Bu migratsiya ATAYLAB alohida (legacy `messages` ustunidan mustaqil):
-- boshqa ustun, boshqa sabab, mustaqil rollback.
--
-- Orqaga qaytarish: shu papkadagi `rollback.sql`.

-- AlterTable
ALTER TABLE "User" DROP COLUMN "deletedAt";
