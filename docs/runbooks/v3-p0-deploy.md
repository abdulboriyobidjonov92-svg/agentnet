# Runbook — V3-P0 to'lqinini prod'ga chiqarish

**Holat (2026-08-22):** ish `origin/v3-p0` branchida (9 commit), `master`
va prod hali `ed06764` da. CI branch push'da ishlamaydi (`ci.yml` faqat
main/master/develop), shuning uchun barcha CI tekshiruvlari lokal
bajarilgan — natijalar §5 da.

**Nega tartib qat'iy:** migratsiya boot yo'lidan chiqarilgan
(`apps/api/Dockerfile`, 2026-08-12 insidenti). Ya'ni yangi kod eski sxema
ustida JIM ishga tushadi. Shu sababli **migratsiya → env → merge** tartibi
buzilmaydi; teskarisi prod'da `ExecutionRun` / `ApprovalEvent` /
`UsageEvent` / `AgentCheckpoint` ga tegadigan har bir yo'lni yiqitadi.

---

## 1. Migratsiya (BIRINCHI — 1 buyruq)

Supabase **session pooler** satri, port **5432** (6543 da `migrate deploy`
advisory-lock'da muzlab qoladi):

```bash
cd /c/Users/User/Claude/Projects/agentnet/apps/api && DATABASE_URL="<supabase-5432-url>" npx prisma migrate deploy
```

Tekshirish:

1. Chiqishdagi `Datasource "db": ... at "<host>"` — **`localhost` bo'lmasin**
   (`apps/api/.env` da lokal URL bor; buyruq oldidagi qiymat undan ustun,
   lekin ko'z bilan tasdiqlang).
2. Aynan **4 ta** migratsiya qo'llanadi:
   `20260817120000_execution_trace_events` ·
   `20260817140000_policy_and_kill_switch` ·
   `20260817160000_agent_checkpoints` ·
   `20260817180000_usage_metering`

To'rttala SQL lokal Postgres'da qo'llangan (`migrate status`: 38/38) —
sintaksis sinovdan o'tgan.

**⚠️ Agar `P3005` yoki checksum mismatch chiqsa — TO'XTANG.** Bu ma'lum
qarz: `20260809220000_sec12_impersonation_…` qo'llanilgandan keyin
tahrirlangan (dev bazada shu bo'lgan). Yo'l: `migrate diff` → fantom
`DROP TABLE "AuditLogHashBackup"` ni olib tashlash → `db execute` →
`migrate resolve --applied`. `--accept-data-loss` va `migrate reset`
**hech qachon** (Rule #27).

---

## 2. Env o'zgaruvchilar (deploy'dan OLDIN)

### 2.1 `AGENT_DOMAIN_ALLOWLIST` — founder qarori, majburiy

Bu deploy bilan `web.automate` **fail-closed** bo'ladi. Chromium API
image'ida o'rnatilgan (`apps/api/Dockerfile:21`), ya'ni brauzer bugun
prod'da ISHLAYDI — sozlamasangiz ishlamay qoladi. Uch yo'l:

| Yo'l | Qiymat (`agentnet-api`) | Natija |
|---|---|---|
| **Tavsiya** | `AGENT_DOMAIN_ALLOWLIST="uzum.uz,soliq.uz,my.gov.uz"` (maks. 5) | Brauzer faqat shu domenlarda; injection boshqa saytga olib chiqa olmaydi |
| Vaqtincha | `AGENT_DOMAIN_ALLOWLIST_ENFORCE=false` | Bugungi xulq AYNAN saqlanadi, himoya YO'Q. Konstitutsiya #39: bayroq 2 sprintdan ortiq yashamaydi |
| Hech narsa | — | Brauzer navigatsiyasi UMUMAN bloklanadi (fail-closed default) |

Domenlar ro'yxati modelga emas, **egaga** tegishli — shuning uchun uni
avtomatik tanlab bo'lmaydi.

### 2.2 `AGENTNET_API_URL` — `agentnet-engine` servisiga

```
AGENTNET_API_URL = https://agentnet-api-zf1h.onrender.com
```

P0-8 checkpoint saqlash uchun. Bugun ta'siri nol (P0-8 oqimga ulanmagan),
lekin usiz engine `/api/internal/checkpoints` ni topa olmaydi.
Fail-open — bo'lmasa ham hech narsa yiqilmaydi.

---

## 3. Deploy

```bash
cd /c/Users/User/Claude/Projects/agentnet && git checkout master && git merge --ff-only v3-p0 && git push origin master
```

`master` ga push CI'ni ham, uchala servis deploy'ini ham ishga tushiradi
(`autoDeploy: yes`).

**Kutilayotgan CI holati:** `npm-audit` jobi **QIZIL bo'ladi** — bu
o'zgarishlarga aloqador emas (§6 ga qarang).

---

## 4. Deploy'dan keyin (5 daqiqa)

```bash
curl -s https://agentnet-api-zf1h.onrender.com/api/health
```

- `version` yangi commit hash'ga tengmi;
- `checks.database` = `ok`;
- `checks.engine` — `engine_http_429` bo'lsa engine uxlab yotibdi
  (free plan), bu ma'lum holat (§6).

So'ng jonli oqim: login → agent → bitta xabar → chatda **qadamlar**
(step-card) ko'rinishi kerak; agent yuqori-riskli konnektor amalini
so'rasa **tasdiq kartasi** chiqadi.

---

## 5. Chiqarilayotgan ishning tekshiruv holati (lokal, 2026-08-22)

| Qism | Natija |
|---|---|
| `apps/api` | tsc 0 · eslint 0 error · jest **1217/1217** · prisma validate ✓ · nest build ✓ |
| `apps/web` | tsc 0 · eslint 0 error · next build ✓ · i18n en/ru/uz 950/950/950 |
| `agent-engine` | ruff ✓ · mypy Success (39 fayl) · pytest 89/89 |
| rollback.sql ×4 | `BEGIN; \i …; ROLLBACK;` bilan lokal Postgres'da bajarildi ✓ |
| Bajarilmagan | `gitleaks` (lokal o'rnatilmagan), `pip-audit` (lokal venv'da install xatosi) — ikkalasini CI bajaradi |

---

## 6. Ma'lum, ALOQADOR BO'LMAGAN muammolar

- **`npm audit` CI jobi qizil:** 3 ta HIGH — `deepmerge-ts` (`prisma` →
  `@prisma/config` orqali). `npm audit fix` yetarli emas, `--force`
  talab qiladi (prisma major bump). Lockfile'ga tegish alohida ish:
  npm 11.16 mavjud lockfile'da yangi override'larni jimgina e'tiborsiz
  qoldiradi (to'liq wipe kerak). Bu to'lqin lockfile'ga TEGMAGAN.
- **Engine 429 / spin-down:** uchala servis `free` planda; engine 15
  daqiqa jimlikdan keyin uxlaydi va API ichki tarmoqdan 429 oladi —
  foydalanuvchining birinchi xabari yiqiladi. Yechim: engine'ni
  `starter` ga (~$7/oy) yoki keep-alive. Founder qaroriga qoldirilgan.
- **Render drifti:** `render.yaml` engine'ni `type: pserv` + `starter`
  deydi, Render'da esa u `web_service` + `free` va ommaviy URL'i bor
  (SEC-10 prod'da qo'llanmagan). Ochiq yuza faqat `/health`.

---

## 7. Rollback (kerak bo'lsa)

Kod: `git revert` yoki `master` ni `ed06764` ga qaytarib push.
Sxema: **teskari tartibda** va har birining `rollback.sql` sarlavhasidagi
ogohlantirishni O'QIB:

```
20260817180000_usage_metering  →  20260817160000_agent_checkpoints
→  20260817140000_policy_and_kill_switch  →  20260817120000_execution_trace_events
```

⚠️ P0-6 rollbacki `Agent.killedAt` ni tashlaydi — **to'xtatilgan agentlar
qayta faollashadi**. Avval ro'yxatni oling va qo'lda pauza qiling.
⚠️ `ApprovalEvent` va `UsageEvent` retroaktiv tiklanmaydi — avval CSV'ga
saqlang (buyruqlar rollback fayllarida).
