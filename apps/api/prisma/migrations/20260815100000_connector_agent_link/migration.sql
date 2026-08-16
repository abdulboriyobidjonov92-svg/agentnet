-- Konnektorni agentga biriktirish — `ConnectorConfig.agentId`.
--
-- Nega: bugungacha `ConnectorConfig` faqat `userId` bilan bog'langan edi va
-- `Agent.toolsConfig` (JSON tool_id ro'yxati) bilan orasida HECH QANDAY
-- bog'lanish yo'q edi. Ya'ni "konnektorni agentga biriktirish" tushunchasi
-- maʼlumot modelida umuman mavjud emas edi — agent ulangan konnektorni
-- ko'ra olmasdi.
--
-- HAMMASI ADDITIVE, orqaga to'liq mos:
--   `agentId` NULLABLE va mavjud qatorlarda NULL bo'lib qoladi. NULL =
--   "foydalanuvchining barcha agentlari ishlatadi" — bu Ulanishlar
--   sahifasining bugungi vaʼdasi ("Bir marta ulang — barcha agentlar
--   foydalanadi"), shuning uchun hozirgi ulanishlarning xulqi o'zgarmaydi.
--   To'ldirilgan `agentId` = FAQAT o'sha agent ko'radi.
--
-- ON DELETE CASCADE: agent o'chirilganda unga xos konnektor sozlamasi ham
-- ketadi. Bu ataylab — config ustunida shifrlangan SIRLAR (bot token, API
-- kalit) yotadi va ular egasiz qolmasligi kerak. `userId` FK'si o'zgarmaydi.
--
-- DIQQAT — bu migratsiya QO'LDA TAHRIRLANGAN (SEC-11/SEC-12 dagi bilan bir
-- xil sabab). `prisma migrate diff` avtomatik ravishda
-- `DROP TABLE "AuditLogHashBackup"` ni ham qo'shdi: u jadval A17
-- migratsiyasi tomonidan xom SQL bilan yaratilgan va ATAYLAB Prisma
-- sxemasida yo'q (audit-zanjir rechain'ining rollback to'ri). Uni bu yerga
-- qo'shish jonli rollback to'rini jimgina o'chirib yuborardi — shuning
-- uchun o'sha satr OLIB TASHLANDI.

-- AlterTable
ALTER TABLE "ConnectorConfig" ADD COLUMN     "agentId" TEXT;

-- CreateIndex
CREATE INDEX "ConnectorConfig_agentId_idx" ON "ConnectorConfig"("agentId");

-- AddForeignKey
ALTER TABLE "ConnectorConfig" ADD CONSTRAINT "ConnectorConfig_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
