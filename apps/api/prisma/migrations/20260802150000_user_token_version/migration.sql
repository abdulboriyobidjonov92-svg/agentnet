-- SEC-03: JWT revocation. Additive, defaulted column — every existing row
-- gets tokenVersion=0, matching what a brand-new user would get. No backfill
-- needed: this is the "current" version for everyone as of this migration.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
