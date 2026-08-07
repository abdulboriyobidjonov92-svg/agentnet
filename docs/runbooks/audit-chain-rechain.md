# Runbook — audit hash-zanjirini kanonik formatga o'tkazish (A17 / ADR-008)

**Risk:** yuqori (huquqiy/ishonch qatlami) · **Qaytariladi:** ha (bayt-aniq nusxa)
**Migratsiya:** `20260807140000_phase3_audit_chain_backup` · **Skript:** `apps/api/scripts/audit-rechain.mjs`

## Nega

Eski hash `record()` ga kelgan **kirish obyektidan** hisoblangan edi, saqlangan
qatordan emas. Natijada zanjirni bazadan qayta hisoblab bo'lmasdi:

- `resourceId` berilmasa JSON'da umuman yo'q edi, DB'da esa `null`;
- `metadata` `jsonb` — Postgres kalitlarni qayta tartiblaydi.

Jonli bazada tasdiqlandi: metadata'li yozuv (`agent.create`) hech qanday usul
bilan qayta hisoblanmasdi, ya'ni **tamper-evidence amalda ishlamas edi**.

Yangi format (yakuniy): hash faqat saqlangan ustunlardan —
`[prevHash, actorId, action, resourceType, resourceId, createdAt, metadata]`,
kanonik JSON (kalitlar rekursiv tartiblangan). Zanjir endi **per-actor**,
lock ham per-actor (`pg_advisory_xact_lock(4771::int, hashtext(actorId))`).

## Tartib (prod)

### 1. Backup

Rule #45 — Render → Postgres → Backups. Bu amal audit jadvalini **yozadi**.

### 2. Migratsiya (eski hash'lar nusxasi)

```bash
npx prisma migrate deploy
```

`AuditLogHashBackup` jadvali yaratiladi va HAR BIR qatorning eski
`prevHash`/`entryHash` qiymati bayt-aniq nusxalanadi. Rollback butunlay shunga
tayanadi — bu qadamni **o'tkazib yubormang**.

Nusxa to'liqligini tekshiring:

```sql
SELECT (SELECT COUNT(*) FROM "AuditLog") AS logs,
       (SELECT COUNT(*) FROM "AuditLogHashBackup") AS backup;
```

Ikkalasi teng bo'lishi SHART.

### 3. Rechain

Skript kompilyatsiya qilingan `dist/auth/audit-hash.js` dan hash logikasini
**import qiladi** (nusxalamaydi) — shuning uchun avval `npm run build`.

```bash
npm run build
node scripts/audit-rechain.mjs --apply
```

### 4. Tasdiqlash (MAJBURIY)

```bash
node scripts/audit-rechain.mjs --verify
```

`mos kelmadi: 0` va `✅ Zanjir butun` bo'lishi SHART. Aks holda 5-bo'limga
(rollback) o'ting.

### 5. Rollback (tekshiruv yiqilsa)

```bash
npx prisma db execute \
  --file prisma/migrations/20260807140000_phase3_audit_chain_backup/rollback.sql \
  --schema prisma/schema.prisma
```

```sql
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260807140000_phase3_audit_chain_backup';
```

So'ng kodni oldingi commit'ga qaytaring (`git revert`) — aks holda yangi
yozuvlar yana kanonik formatda yoziladi.

> **Vaqt oynasi muhim:** rechain'dan KEYIN yozilgan yangi yozuvlar nusxa
> jadvalida yo'q. Rollback faqat rechain'dan **darhol keyin** to'g'ri ishlaydi.
> Shuning uchun 3–4 qadamlar ketma-ket, past trafik oynasida bajariladi.

### 6. Tozalash (tasdiqlangach)

`AuditLogHashBackup` jadvali rollback uchun saqlanadi. Prod'da zanjir
tasdiqlangach va bir necha kun barqaror ishlagach, uni keyingi migratsiya
bilan tashlang:

```sql
DROP TABLE "AuditLogHashBackup";
```

## Kundalik tekshiruv

`verifyChain(actorId)` — `AuditLogService` metodi. Admin panelida (P4) audit
ko'ruvchisi shu orqali "zanjir holati" ustunini ko'rsatadi. Buzilish topilsa
`brokenAt: { id, seq, reason }` qaytadi (`prev_mismatch` — yozuv qo'shilgan/
o'chirilgan; `hash_mismatch` — yozuv tarkibi o'zgartirilgan).
