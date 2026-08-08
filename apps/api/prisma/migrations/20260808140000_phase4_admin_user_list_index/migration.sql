-- Phase 4 / Contract Rule #25 ("Har yangi `findMany` uchun mos indeks bo'lishi
-- shart, `EXPLAIN` bilan tasdiqlanadi") + §6.4 (Users ro'yxati).
--
-- Admin foydalanuvchilar ro'yxati (`GET /admin/users`) kursorli shartnoma
-- bo'yicha AYNAN quyidagi shaklda o'qiydi:
--     ORDER BY "createdAt" DESC, "id" DESC LIMIT n
--
-- `User` jadvalida `createdAt` bo'yicha indeks YO'Q edi. 10 000 qatorli
-- jonli tekshiruvda plan `Seq Scan + Sort` bo'lgan — bugungi hajmda tez
-- (19ms), lekin bu butun jadvalni o'qib SORT qilish demak va §6.1 dagi
-- "1M foydalanuvchi" maqsadida birinchi sezilarli sekinlashuv aynan shu
-- yerda bo'lardi (admin panel esa eng ko'p shu ro'yxatni ochadi).
--
-- Faqat CREATE INDEX — ma'lumot tegilmaydi.
-- Orqaga qaytarish: shu papkadagi `rollback.sql` (DROP INDEX, xavfsiz).
--
-- ESLATMA (prod): katta jadvalda `CREATE INDEX` yozishni bloklaydi. Jadval
-- hajmi sezilarli bo'lsa `CREATE INDEX CONCURRENTLY` bilan qo'lda yarating
-- (u tranzaksiya ichida ishlamaydi, shuning uchun bu faylga qo'yilmagan).

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex: admin fikrlar ro'yxati — status filtri + createdAt tartibi.
-- Mavjud @@index([status]) tartibni bermaydi; kompozit indeks filtrlangan
-- sahifani ham, tartibni ham bitta skanda qoplaydi.
CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt");
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");
