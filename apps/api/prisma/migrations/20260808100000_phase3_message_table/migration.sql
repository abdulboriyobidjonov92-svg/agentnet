-- Phase 3 / Contract A12 (ADR-009), A15: `Conversation.messages Json` ->
-- normallashgan `Message` jadvali.
--
-- SABAB (Contract): JSON'da har yangi xabar = butun massivni o'qish + yozish
-- (O(n), TOAST jarimasi); xabar-darajali pagination/qidiruv/analitika mumkin
-- emas; parallel yozuv advisory-lock bilan seriyalashishga majbur edi.
--
-- STRATEGIYA (Rule #28: dual-write -> backfill -> cutover -> drop):
--   1. Bu migratsiya: jadval + BACKFILL + tranzaksiya ichida TEKSHIRUV.
--      Postgres DDL tranzaksion — tekshiruv yiqilsa HECH NARSA o'zgarmaydi.
--   2. Kod cutover shu deploy'da (o'qish/yozish faqat Message'da).
--   3. Legacy `messages` ustuni MUZLATILGAN holda QOLADI (rollback oynasi) —
--      keyingi migratsiya bilan tashlanadi. Dual-write KERAK EMAS: cutover
--      bitta deploy'da atomik (migratsiya app ishga tushishidan OLDIN
--      bajariladi), yozuvlar oynasi yo'q.
--
-- BACKFILL ID'LARI: `<conversationId>_m<000001>` — deterministik va massiv
-- tartibida LEKSIKOGRAFIK o'suvchi. Tartib shartnomasi `(createdAt, id)`:
-- bir xil timestamp'li tarixiy juftlarda id teng-buzuvchi AYNAN asl massiv
-- tartibini beradi. Yangi xabarlar oddiy cuid oladi.
--
-- TIMESTAMP: `AT TIME ZONE 'UTC'` — ISO satr ('...Z') Prisma konvensiyasi
-- bo'yicha UTC sifatida timestamp(3) ga yoziladi (server tz ta'sir qilmaydi).
--
-- QAT'IYLIK: noma'lum `role` (enum cast xatosi), null `content` yoki null
-- `timestamp` — migratsiya SHU YERDA XATO bilan to'xtaydi. Buzuq tarixiy
-- ma'lumotni jimgina "tuzatish" TAQIQLANGAN (A15 talabi) — to'xtagan deploy
-- ixtiro qilingan konversiyadan yaxshi. Jonli dev bazasi OLDINDAN tekshirildi:
-- 2 suhbat / 6 xabar, kalitlar {role, content, timestamp, demoMode?, halalFlag?},
-- rollar faqat user|assistant, barcha timestamp'lar yaroqli ISO.
-- Prod uchun oldindan-tekshiruv: docs/runbooks/phase3-message-migration.md
--
-- Orqaga qaytarish: shu papkadagi `rollback.sql` (JSON'ni Message'dan QAYTA
-- QURADI — cutover'dan keyin yozilgan yangi xabarlar ham yo'qolmaydi).

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant', 'tool', 'system');

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "halalFlag" TEXT,
    "demoMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: tartib shartnomasi (conversationId, createdAt [, id PK orqali])
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- AddForeignKey: suhbat o'chsa xabarlari ham o'chadi (GDPR yo'li shunga tayanadi)
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BACKFILL: JSON massiv -> qatorlar, WITH ORDINALITY tartibni saqlaydi.
INSERT INTO "Message" ("id", "conversationId", "role", "content", "halalFlag", "demoMode", "createdAt")
SELECT
  c."id" || '_m' || lpad(m.ord::text, 6, '0'),
  c."id",
  (m.msg->>'role')::"MessageRole",
  m.msg->>'content',
  m.msg->>'halalFlag',
  COALESCE((m.msg->>'demoMode')::boolean, false),
  ((m.msg->>'timestamp')::timestamptz AT TIME ZONE 'UTC')
FROM "Conversation" c
CROSS JOIN LATERAL jsonb_array_elements(c."messages") WITH ORDINALITY AS m(msg, ord)
WHERE c."messages" IS NOT NULL AND jsonb_typeof(c."messages") = 'array';

-- TEKSHIRUV (tranzaksiya ichida — yiqilsa butun migratsiya bekor bo'ladi):
-- 1) jami soni, 2) HAR SUHBAT bo'yicha soni mos bo'lishi SHART.
DO $$
DECLARE
  json_total BIGINT;
  row_total  BIGINT;
  mismatched BIGINT;
BEGIN
  SELECT COALESCE(SUM(jsonb_array_length("messages")), 0) INTO json_total
  FROM "Conversation"
  WHERE "messages" IS NOT NULL AND jsonb_typeof("messages") = 'array';

  SELECT COUNT(*) INTO row_total FROM "Message";

  IF json_total <> row_total THEN
    RAISE EXCEPTION 'Backfill mos emas: JSON da % xabar, jadvalda % qator', json_total, row_total;
  END IF;

  SELECT COUNT(*) INTO mismatched FROM (
    SELECT c."id"
    FROM "Conversation" c
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS n FROM "Message" msg WHERE msg."conversationId" = c."id"
    ) mc ON TRUE
    WHERE COALESCE(jsonb_array_length(c."messages"), 0) <> mc.n
  ) bad;

  IF mismatched > 0 THEN
    RAISE EXCEPTION 'Backfill mos emas: % ta suhbatda xabar soni farq qiladi', mismatched;
  END IF;
END $$;
