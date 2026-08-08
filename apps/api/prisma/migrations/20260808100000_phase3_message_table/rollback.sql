-- ORQAGA QAYTARISH — 20260808100000_phase3_message_table
-- (Contract Rule #27: har migratsiya orqaga qaytarish rejasi bilan keladi).
--
-- Ishga tushirish:
--   npx prisma db execute --file prisma/migrations/20260808100000_phase3_message_table/rollback.sql --schema prisma/schema.prisma
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20260808100000_phase3_message_table';
-- So'ng kodni oldingi commit'ga qaytaring (`git revert`) va `npx prisma generate`.
--
-- MUHIM XUSUSIYAT: legacy JSON shunchaki "tiklanmaydi" — u `Message`
-- jadvalidan QAYTA QURILADI. Cutover'dan KEYIN yozilgan yangi xabarlar faqat
-- jadvalda bor; eski JSON'ni qoldirish ularni YO'QOTGAN bo'lardi. Jadval esa
-- backfill tufayli tarixiy xabarlarning ham to'liq manbai. Ya'ni bu rollback
-- istalgan vaqtda ma'lumot yo'qotishsiz ishlaydi.
--
-- Shakl asl JSON bilan SEMANTIK bir xil: `halalFlag` faqat mavjud bo'lsa,
-- `demoMode` faqat true bo'lsa yoziladi (asl yozuvlarda ham kalit faqat
-- qiymat bo'lganda mavjud edi); `timestamp` — JS `toISOString()` formati.

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
                 'timestamp', to_char(m."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
               )
             )
             ORDER BY m."createdAt" ASC, m."id" ASC
           )
    FROM "Message" m
    WHERE m."conversationId" = c."id"
  ),
  '[]'::jsonb
);

DROP TABLE "Message";
DROP TYPE "MessageRole";
