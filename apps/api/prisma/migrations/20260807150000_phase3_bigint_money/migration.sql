-- Phase 3 / Contract A13 (ADR-009): pul ustunlari `Int` -> `BigInt`.
--
-- SABAB (Contract): `Int` shifti 2 147 483 647 tiyin = 21 474 836 so'm
-- (~$1 700). B2B hamyon va agregat (SUM) maydonlar uchun bu REAL chegara —
-- bitta korporativ to'ldirish yoki yillik ledger yig'indisi undan oshadi va
-- to'lov jimgina yiqiladi.
--
-- XAVFSIZ: `int4 -> int8` KENGAYTIRISH (widening). Har bir mavjud qiymat
-- o'zgarishsiz sig'adi; ma'lumot yo'qolishi MUMKIN EMAS. Postgres buni
-- to'g'ridan-to'g'ri bajaradi, `USING` shart emas (lekin aniqlik uchun
-- yozilgan).
--
-- QAMROV — platforma puli (hamyon/daftar/to'lov/marketplace):
--   User.balanceTiyin, Agent.creationPriceTiyin, Agent.monthlyPriceTiyin,
--   Agent.marketplacePrice, AgentInstall.pricePaid, CreatorLedger.amount,
--   Payout.bonusAmountTiyin, CreditLedger.amount, CreditLedger.balanceAfter,
--   PaymeTransaction.amountTiyin, ClickTransaction.amountTiyin
--
-- ATAYLAB QAMRALMAGAN (`Int` qoladi) — vertikal BOZOR ma'lumoti, hamyonga
-- hech qachon oqmaydi va tashqi konnektor API'laridan JS `number` sifatida
-- keladi (Shopify, Uzum, WooCommerce):
--   RetailProduct.price, CompetitorSource.manualPrice, CompetitorPriceCheck.price
-- Ular ledger/balansga tegmasligi tekshirilgan; BigInt qilish har konnektor
-- chegarasiga konvertatsiya qo'shardi, agregat-shift riskini esa kamaytirmasdi.
--
-- Orqaga qaytarish: shu papkadagi `rollback.sql` (int8 -> int4). DIQQAT:
-- rollback FAQAT hech bir qiymat int4 chegarasidan oshmagan bo'lsa xavfsiz —
-- rollback.sql buni O'ZI tekshiradi va oshgan bo'lsa to'xtaydi.

ALTER TABLE "User"             ALTER COLUMN "balanceTiyin"       TYPE BIGINT USING "balanceTiyin"::BIGINT;
ALTER TABLE "Agent"            ALTER COLUMN "creationPriceTiyin" TYPE BIGINT USING "creationPriceTiyin"::BIGINT;
ALTER TABLE "Agent"            ALTER COLUMN "monthlyPriceTiyin"  TYPE BIGINT USING "monthlyPriceTiyin"::BIGINT;
ALTER TABLE "Agent"            ALTER COLUMN "marketplacePrice"   TYPE BIGINT USING "marketplacePrice"::BIGINT;
ALTER TABLE "AgentInstall"     ALTER COLUMN "pricePaid"          TYPE BIGINT USING "pricePaid"::BIGINT;
ALTER TABLE "CreatorLedger"    ALTER COLUMN "amount"             TYPE BIGINT USING "amount"::BIGINT;
ALTER TABLE "Payout"           ALTER COLUMN "bonusAmountTiyin"   TYPE BIGINT USING "bonusAmountTiyin"::BIGINT;
ALTER TABLE "CreditLedger"     ALTER COLUMN "amount"             TYPE BIGINT USING "amount"::BIGINT;
ALTER TABLE "CreditLedger"     ALTER COLUMN "balanceAfter"       TYPE BIGINT USING "balanceAfter"::BIGINT;
ALTER TABLE "PaymeTransaction" ALTER COLUMN "amountTiyin"        TYPE BIGINT USING "amountTiyin"::BIGINT;
ALTER TABLE "ClickTransaction" ALTER COLUMN "amountTiyin"        TYPE BIGINT USING "amountTiyin"::BIGINT;
