# Runbook — `Conversation.messages Json` → `Message` jadvali (A15 / Contract A12)

**Risk:** yuqori (jonli suhbat ma'lumoti) · **Qaytariladi:** ha (yo'qotishsiz, isbotlangan)
**Migratsiya:** `20260808100000_phase3_message_table` · **Tekshiruv:** `scripts/message-backfill-verify.mjs`

## Nima o'zgaradi

Xabarlar `Conversation.messages` (jsonb massiv) o'rniga normallashgan
`Message` jadvalida: `(id, conversationId, role, content, halalFlag,
demoMode, createdAt)`, tartib `(conversationId, createdAt, id)`, FK
`ON DELETE CASCADE`. Legacy ustun **muzlatilgan holda qoladi** (Prisma'da
`legacyMessages @map("messages")`) va rollback-oynasi yopilgach keyingi
migratsiyada tashlanadi.

## 1. Deploy'dan OLDIN — prod'da domen tekshiruvi (MAJBURIY)

Migratsiya noma'lum `role`, null `content` yoki null/yaroqsiz `timestamp`da
**ataylab yiqiladi** (buzuq tarixni jimgina "tuzatish" taqiqlangan). Avval
prod nusxasida:

```sql
-- massiv bo'lmagan messages bormi?
SELECT COUNT(*) FROM "Conversation"
WHERE messages IS NOT NULL AND jsonb_typeof(messages) <> 'array';

-- domen: role / content / timestamp
SELECT m.msg->>'role' AS role,
       COUNT(*) FILTER (WHERE m.msg->>'content' IS NULL) AS null_content,
       COUNT(*) FILTER (WHERE m.msg->>'timestamp' IS NULL) AS null_ts,
       COUNT(*) AS n
FROM "Conversation" c
CROSS JOIN LATERAL jsonb_array_elements(c.messages) AS m(msg)
WHERE c.messages IS NOT NULL AND jsonb_typeof(c.messages) = 'array'
GROUP BY 1;
```

Kutilgan: rollar faqat `user|assistant|tool|system`, `null_content=0`,
`null_ts=0`. Aks holda — **deploy qilmang**, avval ma'lumotni ko'rib chiqing
(qaysi suhbat, qanday qiymat) va qaror qabul qiling.

## 2. Backup

Rule #45: Render → Postgres → Backups tekshiriladi.

## 3. Deploy

`npx prisma migrate deploy` (API konteyneri buni app'dan OLDIN bajaradi) —
jadval + backfill + tranzaksiya-ichi son-tekshiruvi bitta migratsiyada.
Tekshiruv yiqilsa migratsiya to'liq bekor bo'ladi (DDL tranzaksion).

## 4. Deploy'dan KEYIN — chuqur tekshiruv

```bash
node scripts/message-backfill-verify.mjs
```

Har suhbat bo'yicha son/tartib/role/content/halalFlag/demoMode/timestamp
(ms aniqlikda) solishtiriladi + yetim/dublikat tekshiruvi. `✅` bo'lishi SHART.

## 5. Rollback (kerak bo'lsa)

```bash
npx prisma db execute \
  --file prisma/migrations/20260808100000_phase3_message_table/rollback.sql \
  --schema prisma/schema.prisma
```

```sql
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260808100000_phase3_message_table';
```

va kod `git revert` + `npx prisma generate`.

**Muhim xususiyat (jonli isbotlangan):** rollback legacy JSON'ni jadvaldan
**qayta quradi** — cutover'dan keyin yozilgan yangi xabarlar ham JSON'ga
tushadi, hech narsa yo'qolmaydi. Qayta-apply ham toza: backfill id'lari
deterministik, tekshiruv skripti qayta o'tadi (dev'da to'liq sikl bajarilgan:
rollback → yangi xabar JSON'da ✓ → re-apply → mazmun mos ✓).

## 6. Legacy ustunni tashlash — `20260808120000_phase3_drop_legacy_messages`

Migratsiya **yozilgan va dev'da to'liq sinalgan** (apply → rollback →
re-apply). U ustunni tashlashdan OLDIN tranzaksiya ichida JSON'dagi har bir
xabar `Message` jadvalida borligini QAYTA tekshiradi va topilmasa
`RAISE EXCEPTION` bilan to'xtaydi.

> ⚠️ **RELIZ TARTIBI — MAJBURIY.** Bu migratsiya A15 (`20260808100000`)
> bilan **bitta relizda prod'ga chiqmasligi** kerak: `prisma migrate deploy`
> kutilayotgan migratsiyalarning HAMMASINI ketma-ket qo'llaydi va rollback
> oynasini butunlay yo'q qiladi.
>
> To'g'ri tartib: **A15 relizi** → prod'da 4-qadam tekshiruvi yashil →
> bir necha kun barqaror ishlash → **DROP relizi**.

`message-backfill-verify.mjs` skripti DROP relizida o'chirilgan — u legacy
ustunni o'qigani uchun ustun bilan birga yashaydi. 4-qadam tekshiruvini
A15 relizi jonli bo'lgan paytda bajaring.

### Vaqt-mintaqa xatosi (tuzatilgan — qayta kiritmang)

Rollback skriptlarida `to_char(m."createdAt" AT TIME ZONE 'UTC', ...)`
ishlatilgan edi. `createdAt` — `timestamp(3)` (mintaqasiz, UTC saqlaydi);
`AT TIME ZONE 'UTC'` uni `timestamptz`ga aylantiradi va `to_char` **sessiya
mintaqasida** render qiladi → Asia/Tashkent (UTC+5) da har timestamp
**+5 soatga siljiydi**. Dev bazasida 6 xabar shu tarzda buzilgan va
tiklangan. Ustun allaqachon UTC saqlaydi — `to_char` to'g'ridan-to'g'ri
chaqiriladi. Batafsil: `docs/status/phase3-final-audit.md`.
