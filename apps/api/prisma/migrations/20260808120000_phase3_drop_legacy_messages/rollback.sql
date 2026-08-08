-- ORQAGA QAYTARISH — 20260808120000_phase3_drop_legacy_messages
-- (Contract Rule #27: har migratsiya orqaga qaytarish rejasi bilan keladi).
--
-- Ishga tushirish:
--   npx prisma db execute --file prisma/migrations/20260808120000_phase3_drop_legacy_messages/rollback.sql --schema prisma/schema.prisma
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20260808120000_phase3_drop_legacy_messages';
-- So'ng kodni oldingi commit'ga qaytaring (`git revert`) va `npx prisma generate`.
--
-- MA'LUMOT YO'QOLMAYDI: ustun qayta yaratiladi va JSON `Message` jadvalidan
-- QAYTA QURILADI — ya'ni tarixiy xabarlar ham, drop'dan keyin yozilgan yangi
-- xabarlar ham JSON'ga tushadi. Shakl A15 rollback'i bilan AYNAN bir xil
-- (`halalFlag` faqat mavjud bo'lsa, `demoMode` faqat true bo'lsa, timestamp
-- JS `toISOString()` formatida).
--
-- Bu rollback `Message` jadvalini TASHLAMAYDI — u A15 relizining artefakti
-- va o'z rollback'iga ega (20260808100000/rollback.sql).

-- ⚠️ TIMESTAMP — `AT TIME ZONE 'UTC'` ISHLATMANG (jonli bazada topilgan xato):
-- `Message.createdAt` — `timestamp(3)` (vaqt mintaqasiz, UTC qiymat saqlaydi).
-- `ts AT TIME ZONE 'UTC'` uni `timestamptz`ga aylantiradi va `to_char` SESSIYA
-- mintaqasida render qiladi — Asia/Tashkent (UTC+5) da har timestamp +5 soatga
-- SILJIYDI. Bu xato dev bazada 6 xabarni buzgan (aniqlandi: xabar sanasi
-- `Conversation.updatedAt` dan 5 soat KEYIN chiqib qolgan) va tuzatildi.
-- Ustun allaqachon UTC saqlaydi -> to'g'ridan-to'g'ri `to_char` qilinadi.

ALTER TABLE "Conversation" ADD COLUMN "messages" JSONB;

UPDATE "Conversation" c
SET "messages" = COALESCE(
  (
    SELECT jsonb_agg(
             jsonb_strip_nulls(
               jsonb_build_object(
                 'role',      m."role"::text,
                 'content',   m."content",
                 'halalFlag', m."halalFlag",
                 'demoMode',  CASE WHEN m."demoMode" THEN to_jsonb(true) ELSE NULL END,
                 'timestamp', to_char(m."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
               )
             )
             ORDER BY m."createdAt" ASC, m."id" ASC
           )
    FROM "Message" m
    WHERE m."conversationId" = c."id"
  ),
  '[]'::jsonb
);
