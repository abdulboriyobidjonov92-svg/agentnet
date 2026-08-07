-- ORQAGA QAYTARISH — 20260807150000_phase3_bigint_money (BigInt -> Int).
--
-- Ishga tushirish:
--   npx prisma db execute --file prisma/migrations/20260807150000_phase3_bigint_money/rollback.sql --schema prisma/schema.prisma
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20260807150000_phase3_bigint_money';
-- So'ng kodni oldingi commit'ga qaytaring (`git revert`) va `npx prisma generate`.
--
-- ⚠️ TORAYTIRISH (narrowing) — kengaytirishdan farqli o'laroq, bu XAVFSIZ EMAS:
-- int4 chegarasidan (2 147 483 647) oshgan qiymat bo'lsa ma'lumot yo'qoladi.
-- Shuning uchun quyidagi blok AVVAL tekshiradi va oshgan qiymat topilsa
-- `RAISE EXCEPTION` bilan to'xtaydi (Postgres DDL tranzaksion — hech narsa
-- o'zgarmaydi). Jim ma'lumot buzilishidan ko'ra to'xtagan rollback yaxshiroq.

DO $$
DECLARE
  bad BIGINT;
BEGIN
  SELECT MAX(v) INTO bad FROM (
    SELECT MAX(ABS("balanceTiyin")) v FROM "User"
    UNION ALL SELECT MAX(ABS("creationPriceTiyin")) FROM "Agent"
    UNION ALL SELECT MAX(ABS("monthlyPriceTiyin")) FROM "Agent"
    UNION ALL SELECT MAX(ABS("marketplacePrice")) FROM "Agent"
    UNION ALL SELECT MAX(ABS("pricePaid")) FROM "AgentInstall"
    UNION ALL SELECT MAX(ABS(amount)) FROM "CreatorLedger"
    UNION ALL SELECT MAX(ABS("bonusAmountTiyin")) FROM "Payout"
    UNION ALL SELECT MAX(ABS(amount)) FROM "CreditLedger"
    UNION ALL SELECT MAX(ABS("balanceAfter")) FROM "CreditLedger"
    UNION ALL SELECT MAX(ABS("amountTiyin")) FROM "PaymeTransaction"
    UNION ALL SELECT MAX(ABS("amountTiyin")) FROM "ClickTransaction"
  ) t;

  IF bad > 2147483647 THEN
    RAISE EXCEPTION
      'Rollback TO''XTATILDI: pul qiymati int4 chegarasidan oshgan (max=%). Toraytirish ma''lumotni buzardi.', bad;
  END IF;
END $$;

ALTER TABLE "User"             ALTER COLUMN "balanceTiyin"       TYPE INTEGER USING "balanceTiyin"::INTEGER;
ALTER TABLE "Agent"            ALTER COLUMN "creationPriceTiyin" TYPE INTEGER USING "creationPriceTiyin"::INTEGER;
ALTER TABLE "Agent"            ALTER COLUMN "monthlyPriceTiyin"  TYPE INTEGER USING "monthlyPriceTiyin"::INTEGER;
ALTER TABLE "Agent"            ALTER COLUMN "marketplacePrice"   TYPE INTEGER USING "marketplacePrice"::INTEGER;
ALTER TABLE "AgentInstall"     ALTER COLUMN "pricePaid"          TYPE INTEGER USING "pricePaid"::INTEGER;
ALTER TABLE "CreatorLedger"    ALTER COLUMN "amount"             TYPE INTEGER USING "amount"::INTEGER;
ALTER TABLE "Payout"           ALTER COLUMN "bonusAmountTiyin"   TYPE INTEGER USING "bonusAmountTiyin"::INTEGER;
ALTER TABLE "CreditLedger"     ALTER COLUMN "amount"             TYPE INTEGER USING "amount"::INTEGER;
ALTER TABLE "CreditLedger"     ALTER COLUMN "balanceAfter"       TYPE INTEGER USING "balanceAfter"::INTEGER;
ALTER TABLE "PaymeTransaction" ALTER COLUMN "amountTiyin"        TYPE INTEGER USING "amountTiyin"::INTEGER;
ALTER TABLE "ClickTransaction" ALTER COLUMN "amountTiyin"        TYPE INTEGER USING "amountTiyin"::INTEGER;
