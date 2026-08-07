-- Phase 3 / Contract A17 / ADR-008 — audit hash-zanjirini per-actor
-- KANONIK formatga o'tkazish uchun XAVFSIZLIK TO'RI.
--
-- NEGA KERAK: `scripts/audit-rechain.mjs` mavjud HAR BIR `AuditLog` qatorining
-- `prevHash`/`entryHash` qiymatini QAYTA HISOBLAYDI. Bu — huquqiy/ishonch
-- qatlamiga tegadigan yagona qaytarib bo'lmaydigan amal. Shuning uchun
-- rechain'dan OLDIN eski qiymatlar bayt-aniq nusxalanadi; rollback ularni
-- aynan tiklaydi.
--
-- NEGA UMUMAN QAYTA HISOBLANMOQDA: eski hash `record()` ga kelgan KIRISH
-- obyektidan hisoblangan edi, saqlangan qatordan EMAS. Jonli bazada
-- tasdiqlandi — metadata'li yozuvni (`agent.create`) hech qanday usul bilan
-- qayta hisoblab bo'lmasdi, ya'ni zanjir amalda TEKSHIRILMAS edi.
-- Batafsil: apps/api/src/auth/audit-hash.ts va docs/runbooks/audit-chain-rechain.md
--
-- Bu migratsiya SXEMAGA tegmaydi (yangi jadval faqat nusxa uchun) va
-- `AuditLog` ma'lumotini O'ZGARTIRMAYDI — rechain alohida skript bilan
-- bajariladi (runbook'ga qarang).
--
-- TOZALASH: prod'da zanjir tasdiqlangach (`--verify` yashil) bu jadval
-- keyingi migratsiya bilan tashlanadi. Undan oldin O'CHIRMANG — rollback
-- imkoniyati shunga bog'liq.

CREATE TABLE IF NOT EXISTS "AuditLogHashBackup" (
  "id"        TEXT PRIMARY KEY,
  "seq"       INTEGER NOT NULL,
  "prevHash"  TEXT NOT NULL,
  "entryHash" TEXT NOT NULL,
  "backedUpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "AuditLogHashBackup" ("id", "seq", "prevHash", "entryHash")
SELECT "id", "seq", "prevHash", "entryHash" FROM "AuditLog"
ON CONFLICT ("id") DO NOTHING;
