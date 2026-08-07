# Runbook — Phase 3 enum migratsiyasi (`20260807120000_phase3_status_enums`)

**Contract:** A14 / ADR-009 · **Risk:** o'rta (jonli ma'lumot, pul yo'li tegadi)
**Qaytariladi:** ha — `rollback.sql` migratsiya papkasida, jonli bazada sinalgan.

## Nima o'zgaradi

10 ta ustun `String` dan `enum` ga o'tadi:

| Jadval.ustun | Enum |
|---|---|
| `User.platformPlan` | `PlatformPlan` (none, pro, max, max200, enterprise) |
| `Agent.frozenReason` | `AgentFrozenReason` (trial_expired, monthly_payment_failed) |
| `Feedback.status` | `FeedbackStatus` (new, seen, resolved) |
| `DevicePermission.category` | `DeviceCategory` (6 toifa) |
| `DeviceActionLog.category` | `DeviceActionCategory` (6 toifa + connect) |
| `DeviceCommand.kind` | `CommandKind` |
| `DeviceCommand.status` | `CommandStatus` |
| `CreditLedger.kind` | `LedgerKind` (**pul yo'li**) |
| `PaymeTransaction.purpose` | `PaymentPurpose` |
| `ClickTransaction.purpose` | `PaymentPurpose` |

Ma'lumot **o'zgarmaydi** — faqat ustun turi (`USING` cast). Qiymatlar bir xil
matn bo'lib qoladi.

## 1. Deploy'dan OLDIN — prod'da domen tekshiruvi (MAJBURIY)

Migratsiya enum'da bo'lmagan qiymatga duch kelsa **to'xtaydi** (Postgres DDL
tranzaksion — hech narsa o'zgarmaydi, deploy yiqiladi). Shuning uchun avval
prod nusxasida quyidagini ishga tushiring:

```sql
SELECT 'User.platformPlan' t, "platformPlan" v, COUNT(*) n FROM "User" GROUP BY 2
UNION ALL SELECT 'Agent.frozenReason', "frozenReason", COUNT(*) FROM "Agent" GROUP BY 2
UNION ALL SELECT 'Feedback.status', status, COUNT(*) FROM "Feedback" GROUP BY 2
UNION ALL SELECT 'DevicePermission.category', category, COUNT(*) FROM "DevicePermission" GROUP BY 2
UNION ALL SELECT 'DeviceActionLog.category', category, COUNT(*) FROM "DeviceActionLog" GROUP BY 2
UNION ALL SELECT 'DeviceCommand.kind', kind, COUNT(*) FROM "DeviceCommand" GROUP BY 2
UNION ALL SELECT 'DeviceCommand.status', status, COUNT(*) FROM "DeviceCommand" GROUP BY 2
UNION ALL SELECT 'CreditLedger.kind', kind, COUNT(*) FROM "CreditLedger" GROUP BY 2
UNION ALL SELECT 'PaymeTransaction.purpose', purpose, COUNT(*) FROM "PaymeTransaction" GROUP BY 2
UNION ALL SELECT 'ClickTransaction.purpose', purpose, COUNT(*) FROM "ClickTransaction" GROUP BY 2
ORDER BY 1, 3 DESC;
```

Har bir qiymat yuqoridagi jadvaldagi enum ichida bo'lishi SHART. Bo'lmasa —
**deploy qilmang**: avval qiymatni tuzating yoki enum'ga qo'shing (yangi
migratsiya bilan), keyin qayta urinib ko'ring.

> Aynan shu tekshiruv dev'da bitta xatoni ushladi: `schema.prisma` izohi
> `platformPlan` domenini `none|pro|max|enterprise` deb yozgan edi, lekin
> `PLATFORM_PLANS` (platform-billing.service.ts) `max200` tarifini ham
> sotadi. Izohga ishonib enum yozilganda `max200` obunachisi bo'lgan har
> qanday bazada migratsiya yiqilardi.

## 2. Backup

Rule #45: deploy oldidan backup mavjudligi tasdiqlanadi. Render → Postgres →
Backups → oxirgi nusxa sanasi tekshiriladi.

## 3. Deploy

```bash
npx prisma migrate deploy
```

API konteyneri build vaqtida shuni ishga tushiradi; qo'shimcha qadam yo'q.

## 4. Deploy'dan KEYIN — tekshiruv

```sql
SELECT table_name||'.'||column_name AS col, udt_name
FROM information_schema.columns
WHERE (table_name, column_name) IN
  (('User','platformPlan'),('Agent','frozenReason'),('Feedback','status'),
   ('DevicePermission','category'),('DeviceActionLog','category'),
   ('DeviceCommand','kind'),('DeviceCommand','status'),('CreditLedger','kind'),
   ('PaymeTransaction','purpose'),('ClickTransaction','purpose'))
ORDER BY 1;
```

`udt_name` ustunida `text` emas, enum nomi turishi kerak. Qator sonlari
migratsiyadan oldingi bilan bir xil bo'lishi shart.

## 5. Rollback (kerak bo'lsa)

```bash
npx prisma db execute \
  --file prisma/migrations/20260807120000_phase3_status_enums/rollback.sql \
  --schema prisma/schema.prisma
```

So'ng:

```sql
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260807120000_phase3_status_enums';
```

va kodni oldingi commit'ga qaytaring (`git revert`), `npx prisma generate`.

**Ma'lumot yo'qolmaydi:** enum → text cast har doim muvaffaqiyatli. Bu rollback
jonli dev bazasida BAJARILGAN va tekshirilgan (ustunlar `text`ga qaytdi,
`CreditLedger` qatorlari o'zgarishsiz qoldi), keyin migratsiya qayta qo'llandi.
