# Runbook — Backup va Restore mashqi

**Bosqich:** Phase 5 (P5.6) · **Sana:** 2026-08-11 · **Holat:** lokal mashq BAJARILDI
**Skript:** [`apps/api/scripts/backup-restore-drill.mjs`](../../apps/api/scripts/backup-restore-drill.mjs)
**Bog'liq:** [`incident-response.md`](incident-response.md) · [`secret-rotation.md`](secret-rotation.md)

> **Asosiy tamoyil:** "Backup bor" degani "tiklash ishlaydi" degani EMAS.
> Bu hujjat aynan shu farqni yopadi — va uni **takrorlanadigan** qiladi.

---

## 1. Bugungi backup holati (audit natijasi)

| Savol | Javob |
|---|---|
| Backup mavjudmi? | **Ha** — Render Postgres `starter` plani avtomatik kunlik backup qiladi (Render tomonidan boshqariladi). |
| Repoda backup skripti bormi? | **Yo'q edi.** Phase 5 gacha loyihada hech qanday backup/restore kodi yoki hujjati yo'q edi. |
| Tiklash sinab ko'rilganmi? | **Yo'q edi.** Phase 5 (bu hujjat) — birinchi mashq. |
| Shifrlangan ma'lumot tiklanadimi? | Endi **tekshiriladi** (§4.5). Bu eng katta yashirin xavf edi: kalitsiz damp — foydasiz damp. |

**Nima uchun bu muhim:** DB dampi o'zi to'liq tiklansa ham, `ENCRYPTION_KEY`
yo'qolgan bo'lsa konnektor tokenlari, 2FA sirlari, brauzer sessiyalari va
qo'ng'iroq yozuvlari **abadiy** ochilmaydi. Ya'ni backup strategiyasi
**ikki qismdan** iborat: (a) ma'lumot, (b) kalit. Ular **alohida**
saqlanadi va **ikkalasi ham** kerak.

---

## 2. RTO / RPO farazlari

> Bular **farazlar** (Render SLA va lokal o'lchovga asoslangan), sinovdan
> o'tgan prod kafolati emas. Prod tiklash hali **bajarilmagan** —
> `docs/status/phase5-observability-audit.md` da BLOKLANGAN sifatida.

| Ko'rsatkich | Qiymat | Asos |
|---|---|---|
| **RPO** (ma'lumot yo'qotish oynasi) | ≤ 24 soat | Render `starter` kunlik backup. Point-in-time tiklash `starter` da **yo'q** — bu haqiqiy cheklov. |
| **RTO** (tiklash vaqti) | 30–60 daqiqa | Lokal mashq: 260 KB damp uchun **< 20 soniya**. Prod hajmi katta bo'ladi; asosiy vaqt — Render'da yangi baza yaratish va qayta ulash. |
| Kalitni tiklash | Darhol | `ENCRYPTION_KEY` Render env-guruhida; u DB backup'iga **kirmaydi**. |

**RPO'ni yaxshilash yo'li (hali bajarilmagan):** Render Postgres'ni
`standard` planiga ko'tarish point-in-time recovery beradi (RPO → daqiqalar).
Bu **xarajat qarori** — Contract A38 bo'yicha 100k foydalanuvchida
rejalashtirilgan.

---

## 3. Mashqni ishga tushirish

**Talablar:** PostgreSQL mijoz vositalari (`pg_dump`, `pg_restore`,
`createdb`, `dropdb`, `psql`) `PATH` da; `apps/api` build qilingan
(`npx nest build` — skript `dist/` dan kripto va audit modullarini
**import qiladi**, nusxalamaydi).

```bash
cd apps/api
npx nest build
node scripts/backup-restore-drill.mjs
```

Drill bazasini tekshirish uchun saqlab qolish:

```bash
node scripts/backup-restore-drill.mjs --keep
```

### Xavfsizlik chegaralari (skriptda majburlangan)

1. **Manba bazaga hech qachon yozilmaydi** — faqat `pg_dump` (o'qish).
2. `DROP DATABASE` **faqat** skript o'zi yaratgan `agentnet_drill_*`
   bazasiga qo'llanadi (nom prefiksi qat'iy tekshiriladi).
3. **Prod manba bloklangan:** `DATABASE_URL` hosti localhost bo'lmasa
   skript to'xtaydi. Ataylab masofaviy manbadan **o'qish** uchun
   `--allow-remote-source` kerak.
4. Parol/kalit/ulanish satri **hech qachon** chiqarilmaydi; xato matnidan
   ham parol kesiladi.
5. Ochiq matn (dekriptlangan qiymat) **hech qachon** chop etilmaydi —
   faqat "ochildi / ochilmadi".

---

## 4. Mashq nimani tekshiradi

Skript ikki toifa natija beradi:

- **`✅ / ❌` — tiklash sodiqligi.** Bitta ❌ = mashq yiqildi.
- **`⚠️` — manba ma'lumoti holati.** Tiklangan nusxa manbani aynan
  takrorlaydi; manba anomaliyasi tiklash nosozligi EMAS, lekin jim ham
  qolmaydi.

| # | Tekshiruv | Nega |
|---|---|---|
| 4.1 | Damp olindi va bo'sh emas | Eng asosiy: backup umuman chiqdimi |
| 4.2 | Izolyatsiyalangan bazaga tiklandi | `pg_restore` ishlaydimi |
| 4.3 | Sxema to'liq (jadval soni mos) | Yarim tiklash aniqlanadi |
| 4.4 | Migratsiya tarixi aynan ko'chdi | `_prisma_migrations` — Prisma keyin ishlashi uchun shart |
| 4.5 | **Shifrlangan ma'lumot JORIY kalit bilan ochiladi** | Kalit + ma'lumot mosligi — mashqning eng muhim qadami |
| 4.6 | **Audit-zanjir butun** (ADR-008) | Huquqiy qatlam tiklashda buzilmadimi |
| 4.7 | Kritik jadvallar qator soni mos | `User`, `Agent`, `CreditLedger`, `AuditLog`, `Payme/ClickTransaction`, `ConnectorConfig`, `Conversation` |
| 4.8 | Vakil yozuvlar Prisma orqali o'qiladi | Klient sxemaga mosmi (tiklangan baza **ishlatsa bo'ladimi**) |
| 4.9 | Balans / ledger o'qildi va taqqoslandi | Pul butunligi signali |

---

## 5. Oxirgi mashq natijasi (lokal, 2026-08-11)

Muhit: Windows, PostgreSQL 16, manba `agentnet_dev` (lokal).

```
✅ Backup olindi — 259.9 KB
✅ Izolyatsiyalangan bazaga tiklandi — agentnet_drill_20260811185022
✅ Sxema to‘liq — 46/46 jadval
✅ Migratsiya tarixi aynan ko‘chdi — 33 qo‘llangan (manba: 33)
✅ User 19 · Agent 14 · CreditLedger 10 · AuditLog 36 · Conversation 2 (hammasi mos)
✅ Kritik jadvallar mos — 8/8
✅ Shifrlangan ma‘lumot JORIY kalit bilan ochiladi — 1/1 ochildi
✅ Audit-zanjir butun — 36/36 yozuv
✅ Vakil yozuvlar o‘qiladi — user=19, agent=14, ledger=10
✅ Balans / ledger o‘qildi — 4 foydalanuvchi tekshirildi

Natija: 17/17 tekshiruv o‘tdi
```

### Topilgan ogohlantirishlar (manba ma'lumoti — damp aybdor emas)

**⚠️ 1. Orqaga qaytarilgan migratsiya yozuvi.**
`_prisma_migrations` da `20260809220000_sec12_impersonation_and_user_write_actions`
**ikki marta** yozilgan: biri `rolled_back_at` bilan (muvaffaqiyatsiz
urinish), biri muvaffaqiyatli. `prisma migrate status` "up to date" deydi
va sxema to'g'ri — ya'ni bu **lokal dev artefakti** (`migrate dev` bir marta
yiqilib, keyin qayta qo'llangan).
**Ta'siri:** yo'q. **Amal:** prod bazada shu so'rov bilan tekshirilsin:
```sql
SELECT migration_name, rolled_back_at FROM _prisma_migrations WHERE rolled_back_at IS NOT NULL;
```
Prod'da natija bo'sh bo'lishi kutiladi. Bo'sh bo'lmasa — hodisa (§10,
incident-response).

**⚠️ 2. Balans / ledger nomuvofiqligi (1/4 foydalanuvchi).**
Bitta lokal foydalanuvchida `User.balanceTiyin` (50 000 000) oxirgi
`CreditLedger.balanceAfter` (31 100 000) bilan mos emas; o'sha
foydalanuvchida atigi 1 ta ledger yozuvi bor.
**Baho:** deyarli aniq **lokal dev seed/qo'lda tahrir** izi — bu bazada
tarixan qo'lda balans qo'yilgan. **Bu prod xatosi deb DA'VO
QILINMAYDI — tekshirilmagan.**
**Amal (prod'da bajarilishi kerak):**
```sql
SELECT u.id
FROM "User" u
JOIN LATERAL (
  SELECT l."balanceAfter" FROM "CreditLedger" l
  WHERE l."userId" = u.id ORDER BY l."createdAt" DESC LIMIT 1
) last ON true
WHERE last."balanceAfter" <> u."balanceTiyin";
```
Natija bo'sh bo'lishi kutiladi. Bo'sh bo'lmasa — §10 (ma'lumot buzilishi).

---

## 6. HAQIQIY tiklash tartibi (prod hodisasi)

> Bu — mashq emas, **hodisa** tartibi. Har qadam OWNER tasdig'i bilan.

**Oldindan:** [`incident-response.md` §2](incident-response.md#2-database-uzilishi)
bo'yicha **yozish to'xtatilgan** bo'lishi shart.

1. **Yo'qotish oynasini aniqlang.** Render → Postgres → Backups: eng
   yaqin sog'lom nusxa vaqti. Shu vaqtdan keyingi ma'lumot **yo'qoladi**
   (RPO). Bu raqamni yozib oling — u foydalanuvchi xabarida kerak.
2. **Yangi bazaga tiklang, mavjudining ustidan EMAS.** Render backup'ni
   yangi instansga tiklaydi. Sabab: buzilgan asl nusxa dalil sifatida
   qoladi (§10 diagnostikasi uchun).
3. **Kalitni tekshiring.** `ENCRYPTION_KEY` (va rotatsiya davomida
   `ENCRYPTION_KEY_PREVIOUS`) backup vaqtidagi kalit bilan mos bo'lishi
   SHART. Mos kelmasa — [`secret-rotation.md`](secret-rotation.md).
4. **Mashqni tiklangan nusxaga qarshi ishga tushiring:**
   ```bash
   DATABASE_URL="<tiklangan baza>" node scripts/backup-restore-drill.mjs --allow-remote-source
   ```
   17/17 o'tmaguncha **trafik ulanmaydi**.
5. **Migratsiya holatini tekshiring:** `npx prisma migrate status`.
   Kod tiklangan bazadan **yangiroq** bo'lsa — kutilayotgan migratsiyalarni
   qo'llang (`prisma migrate deploy`), `migrate dev` EMAS.
6. **Audit-zanjir:** `node scripts/audit-rechain.mjs --verify`. Zanjir
   uzilgan bo'lsa — [`audit-chain-rechain.md`](audit-chain-rechain.md);
   rechain **faqat** sabab hujjatlashtirilgandan keyin.
7. **`DATABASE_URL` ni yangi bazaga o'tkazing** → API qayta deploy →
   `/api/health/ready` 200 bo'lishini kuting.
8. **Pul yo'lini tekshiring:** test rejimida bitta to'ldirish →
   `CreditLedger` yozuvi + `balanceAfter` = `User.balanceTiyin`.
9. **Yozishni qayta oching.**
10. **Foydalanuvchilarga xabar:** yo'qotish oynasi (RPO) aniq aytiladi.

---

## 7. Kalit backup'i (ma'lumotdan ALOHIDA)

`ENCRYPTION_KEY` **DB backup'iga kirmaydi va kirmasligi kerak**. Uning
yagona manbai — Render env-guruh.

**Talab:** kalitning offline nusxasi (parol menejeri / muhrlangan konvert)
OWNER'da bo'lishi shart. **Kalitsiz backup — foydasiz backup.**

**Rotatsiyadan keyingi jiddiy nozik nuqta:** kalit rotatsiya qilingandan
keyin **eski backuplar yangi kalit bilan ochilmaydi**. Shu sababli
rotatsiya paytida eski kalit **kamida backup saqlash muddati davomida**
(bugun: 24 soat + qo'lda nusxalar) saqlanishi shart. Bu
[`secret-rotation.md`](secret-rotation.md) da ham qayd etilgan.

---

## 8. Takrorlash jadvali (tavsiya)

| Nima | Qachon | Kim |
|---|---|---|
| Lokal mashq (bu skript) | Har relizdan oldin (migratsiya bo'lsa — majburiy) | Muhandis |
| Prod backup mavjudligini ko'rish | Haftalik | Muhandis |
| **Prod'dan bir martalik bazaga to'liq tiklash mashqi** | Choraklik | OWNER + muhandis |
| Kalit offline nusxasi joyidami | Choraklik | OWNER |

**Diqqat:** choraklik prod mashqi hali **bir marta ham bajarilmagan** —
u Phase 5 ning ochiq qoldirilgan bandi
(`docs/status/phase5-observability-audit.md` → "production konfiguratsiyasi
kerak").
