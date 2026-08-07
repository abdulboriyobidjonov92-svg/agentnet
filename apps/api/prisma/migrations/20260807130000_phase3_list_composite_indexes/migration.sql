-- Phase 3 / Contract Rule #25 ("Har yangi findMany uchun mos indeks bo'lishi
-- shart, EXPLAIN bilan tasdiqlanadi") + ARCHITECTURAL_AUDIT §7.3
-- ("Yetishmayotgan indekslar").
--
-- Kursorli pagination (commit 20b8aca) shu uch ro'yxatni AYNAN quyidagi
-- shaklda o'qiydi:
--     WHERE "userId" = $1 ORDER BY <sana> DESC, "id" DESC LIMIT n
-- Bugungi indekslar faqat bitta ustunli (`userId`), ya'ni Postgres har
-- sahifada topilgan qatorlarni QAYTADAN sort qilardi. Foydalanuvchida
-- suhbat/ledger soni o'sganda bu birinchi sezilarli sekinlashuv bo'lardi
-- (va admin panel filtrlarida darhol ko'rinardi).
--
-- XAVFSIZLIK: faqat CREATE INDEX — ma'lumot o'zgarmaydi, ustun/tur tegilmaydi.
-- Orqaga qaytarish: shu papkadagi `rollback.sql` (DROP INDEX).
--
-- ESLATMA (prod): katta jadvalda `CREATE INDEX` yozishni bloklaydi. Jadval
-- hajmi sezilarli bo'lsa `CREATE INDEX CONCURRENTLY` bilan qo'lda yarating
-- (u tranzaksiya ichida ishlamaydi, shuning uchun bu faylga qo'yilmagan) va
-- migratsiyani `_prisma_migrations` ga qo'lda "applied" deb belgilang —
-- runbook: docs/runbooks/phase3-enum-migration.md dagi naqsh.

-- CreateIndex
CREATE INDEX "Agent_userId_createdAt_idx" ON "Agent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "CreditLedger_userId_createdAt_idx" ON "CreditLedger"("userId", "createdAt");
