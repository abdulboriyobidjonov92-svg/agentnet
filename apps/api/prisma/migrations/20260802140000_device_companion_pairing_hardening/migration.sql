-- SEC-01: companion pairing hardening — expiry + token-issue tracking.
-- Both columns nullable, no backfill needed (existing rows: pending rows had
-- no expiry concept before this migration; paired rows get NULL tokenIssuedAt
-- until their next /companion/refresh, at which point authCompanion's normal
-- flow populates it).

-- AlterTable
ALTER TABLE "DeviceCompanion" ADD COLUMN "pairingExpiresAt" TIMESTAMP(3);
ALTER TABLE "DeviceCompanion" ADD COLUMN "tokenIssuedAt" TIMESTAMP(3);
