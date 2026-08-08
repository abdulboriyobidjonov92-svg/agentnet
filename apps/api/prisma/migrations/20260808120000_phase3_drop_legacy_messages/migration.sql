-- Phase 3 / A15 yakuni: legacy `Conversation.messages` (jsonb) ustunini
-- TASHLASH. Bu — A15'ning oxirgi qadami (Rule #28: dual-write -> backfill
-- -> cutover -> DROP).
--
-- ⚠️ RELIZ TARTIBI (prod uchun MAJBURIY):
-- Bu migratsiya `20260808100000_phase3_message_table` bilan BIR RELIZDA
-- prod'ga chiqmasligi kerak. A15 runbook'i talab qiladi: avval A15 relizi
-- deploy qilinadi, prod'da tekshiruv (`message-backfill-verify.mjs`) yashil
-- bo'ladi, bir necha kun barqaror ishlaydi — FAQAT SHUNDAN KEYIN bu reliz
-- chiqariladi. `prisma migrate deploy` kutilayotgan MIGRATSIYALARNING
-- HAMMASINI ketma-ket qo'llaydi, ya'ni ikkalasini bitta deploy'ga qo'yish
-- rollback oynasini butunlay yo'q qiladi.
-- Batafsil: docs/runbooks/phase3-message-migration.md §6.
--
-- XAVFSIZLIK QULFI: ustun tashlanishidan OLDIN quyidagi blok JSON'dagi har
-- bir xabar `Message` jadvalida borligini QAYTA tekshiradi. Backfill
-- bajarilmagan yoki to'liq bo'lmagan bazada migratsiya XATO bilan to'xtaydi
-- (Postgres DDL tranzaksion — ustun saqlanib qoladi). Ya'ni bu migratsiya
-- "ishonch"ga emas, ISBOTGA tayanadi.
--
-- Orqaga qaytarish: shu papkadagi `rollback.sql` — ustunni qayta yaratadi va
-- `Message` jadvalidan JSON'ni QAYTA QURADI (ma'lumot yo'qolmaydi).

DO $$
DECLARE
  json_total BIGINT;
  covered    BIGINT;
BEGIN
  -- Legacy JSON'dagi jami xabarlar
  SELECT COALESCE(SUM(jsonb_array_length("messages")), 0) INTO json_total
  FROM "Conversation"
  WHERE "messages" IS NOT NULL AND jsonb_typeof("messages") = 'array';

  -- Ulardan nechtasi Message jadvalida MAVJUD (conversationId + role +
  -- content + createdAt bo'yicha aynan moslik)
  SELECT COUNT(*) INTO covered
  FROM "Conversation" c
  CROSS JOIN LATERAL jsonb_array_elements(c."messages") AS j(msg)
  WHERE c."messages" IS NOT NULL
    AND jsonb_typeof(c."messages") = 'array'
    AND EXISTS (
      SELECT 1 FROM "Message" m
      WHERE m."conversationId" = c."id"
        AND m."role"::text = j.msg->>'role'
        AND m."content" = j.msg->>'content'
        AND m."createdAt" = ((j.msg->>'timestamp')::timestamptz AT TIME ZONE 'UTC')
    );

  IF json_total <> covered THEN
    RAISE EXCEPTION
      'DROP TO''XTATILDI: legacy JSON da % xabar bor, Message jadvalida faqat % tasi topildi. Avval backfill ni yakunlang.',
      json_total, covered;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "messages";
