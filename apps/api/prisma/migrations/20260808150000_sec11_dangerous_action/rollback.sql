-- ORQAGA QAYTARISH — 20260808150000_sec11_dangerous_action (Rule #27).
--
-- Ishga tushirish:
--   npx prisma db execute --file prisma/migrations/20260808150000_sec11_dangerous_action/rollback.sql --schema prisma/schema.prisma
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20260808150000_sec11_dangerous_action';
-- So'ng kodni oldingi commit'ga qaytaring va `npx prisma generate`.
--
-- DIQQAT: jadval xavfli amallar TARIXINI saqlaydi. Rollback uni tashlaydi,
-- ya'ni bajarilgan/bekor qilingan amallar yozuvi YO'QOLADI. Amallarning
-- O'ZI (rol o'zgarishi, sessiya bekor qilinishi) `AuditLog` da alohida
-- qoladi — audit-zanjir bu jadvalga bog'liq EMAS. Shuning uchun rollback
-- forensik izni yo'qotmaydi, faqat holat-mashinasi yozuvlarini oladi.

DROP TABLE IF EXISTS "DangerousAction";
DROP TYPE IF EXISTS "DangerousActionStatus";
DROP TYPE IF EXISTS "DangerousActionKind";
