-- ORQAGA QAYTARISH — 20260807140000_phase3_audit_chain_backup (+ rechain).
--
-- Eski (kanonikdan OLDINGI) hash qiymatlarini bayt-aniq tiklaydi va
-- nusxa-jadvalni tashlaydi.
--
-- Ishga tushirish:
--   npx prisma db execute --file prisma/migrations/20260807140000_phase3_audit_chain_backup/rollback.sql --schema prisma/schema.prisma
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20260807140000_phase3_audit_chain_backup';
-- So'ng kodni oldingi commit'ga qaytaring (`git revert`) — aks holda yangi
-- yozuvlar yana kanonik formatda yoziladi va zanjir aralashib ketadi.
--
-- DIQQAT: rechain'dan KEYIN yozilgan YANGI audit yozuvlari nusxa-jadvalda
-- YO'Q (ular kanonik formatda tug'ilgan). Ular o'z hash'i bilan qoladi —
-- ya'ni rollback'dan keyin zanjir eski/yangi chegarada uziladi. Shuning
-- uchun rollback FAQAT rechain'dan darhol keyin, tekshiruv yiqilganda
-- ma'noga ega.

UPDATE "AuditLog" a
SET "prevHash" = b."prevHash",
    "entryHash" = b."entryHash"
FROM "AuditLogHashBackup" b
WHERE a."id" = b."id";

DROP TABLE IF EXISTS "AuditLogHashBackup";
