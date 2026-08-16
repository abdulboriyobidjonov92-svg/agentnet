# Runbook — Hodisaga javob (Incident Response)

**Bosqich:** Phase 5 (P5.7) · **Sana:** 2026-08-11 · **Holat:** amaldagi
**Bog'liq:** [`backup-restore.md`](backup-restore.md) · [`secret-rotation.md`](secret-rotation.md) · [`audit-chain-rechain.md`](audit-chain-rechain.md)

> Bu hujjat **ijro qo'llanmasi**. Har bo'lim bir xil tuzilishga ega:
> **Aniqlash → Darhol jilovlash → Diagnostika → Tiklash → Tasdiqlash →
> Kommunikatsiya → Hodisadan keyin.**

---

## 0. Umumiy qoidalar (har hodisada amal qiladi)

**Rollar va vakolat (mavjud RBAC modeliga mos — Contract A8/ADR-002):**

| Rol | Hodisadagi vakolat |
|---|---|
| `OWNER` | Yagona eskalatsiya nuqtasi. Kalit rotatsiyasi, ma'lumot tiklash, to'lovni to'xtatish — faqat u tasdiqlaydi. |
| `ADMIN` | Diagnostika, admin panel orqali o'qish, xavfli amallarni **so'rash** (§6.5 oqimi — tasdiq baribir kerak). |
| `SUPPORT` | Faqat o'qish + impersonation (read-only). Hech qanday tiklash amali YO'Q. |

**Buzilmaydigan qoidalar:**

1. **Sirni chatga/ticketga ko'chirmang.** Kalit, token, DSN, ulanish satri —
   hech qachon. Ular faqat Render env'da yashaydi.
2. **Prod bazasida qo'lda `DELETE`/`UPDATE` qilmang.** Har o'zgarish
   migratsiya yoki admin endpoint orqali (audit yozuvi qoladi).
3. **`prisma migrate reset` prod'da TAQIQLANADI.** Hech qanday sharoitda.
4. **Audit yozuvini o'chirmang/tuzatmang.** U huquqiy qatlam (ADR-008).
   Zanjir buzilgan bo'lsa — [`audit-chain-rechain.md`](audit-chain-rechain.md).
5. **Har hodisa uchun `request_id` yig'ing.** U uchala servis logini bog'laydi
   (BFF → API → engine). Foydalanuvchi 500 xatosida uni javobda ko'radi.

**Kuzatuv manbalari (Phase 5 dan beri):**

| Nima kerak | Qayerdan |
|---|---|
| Xato + stack | Sentry (agar `SENTRY_DSN` sozlangan bo'lsa) |
| So'rov oqimi, davomiylik, status | Render loglari — JSON (pino), `reqId` bo'yicha filtr |
| Bog'liqliklar holati | `GET /api/health` (diagnostik), `/api/health/ready`, `/api/health/live` |
| Kim nima qildi | `AuditLog` jadvali (admin panel → Audit) |
| Signal | Telegram (`OWNER_ALERT_TELEGRAM_CHAT_ID`) + Sentry xabari + log |

**Alert → runbook xaritasi:**

| Alert kaliti | Bo'lim |
|---|---|
| `infrastructure_degraded` | [§2](#2-database-uzilishi) (DB) / [§1](#1-ilova-uzilishi-api--web) (5xx) |
| `payment_failure_anomaly` | [§5](#5-tolov-xatoligi) |
| `auth_anomaly` | [§6](#6-autentifikatsiya-xavfsizlik-hodisasi) |
| `agent_execution_failure` | [§9](#9-abnormal-agent-ijrosi) |

**Alert cheklovi (halol yozilgan):** dedup/cooldown va 401/403/5xx
hisoblagichlari **jarayon ichida** yashaydi. Bugun API bitta instansda
ishlaydi (`render.yaml`, `plan: free`) — ya'ni bu amalda cheklov emas.
Instans soni oshsa: (a) bir hodisa uchun bir nechta signal kelishi mumkin,
(b) 5xx/401 chegaralari instanslar bo'yicha bo'linadi. Taqsimlangan hisob
Redis talab qiladi — **Phase 6** (ADR-006).

---

## 1. Ilova uzilishi (API / web)

**Aniqlash**
- `infrastructure_degraded` alerti (5xx sababli), yoki
- `GET /api/health/live` javob bermayapti, yoki
- Render "Deploy failed" / servis restart tsikli.

**Darhol jilovlash**
1. `GET /api/health/live` — jarayon tirikmi?
   - **Javob yo'q** → jarayon o'lgan/osilgan. Render → servis → **Restart**.
   - **200** → jarayon tirik, muammo pastroqda → §2 (DB) yoki §4 (engine).
2. `GET /api/health/ready` — 503 bo'lsa `checks` maydoniga qarang
   (`database` / `config`).
3. Uzilish oxirgi deploy'dan keyin boshlangan bo'lsa → **§11 rollback**.

**Diagnostika**
- Render loglari: `"level":"error"` bo'yicha filtr; `err.type` va `err.code`
  darhol sinfni beradi.
- Sentry: eng ko'p takrorlanayotgan yangi xato (`release` bo'yicha guruh).
- `config` tekshiruvi `config_missing_N` bersa — env guruhida qiymat
  yo'qolgan (Render → Environment).

**Tiklash**
- Kod xatosi → §11 rollback.
- Konfiguratsiya xatosi → env'ni to'g'rilang → qayta deploy.
- Resurs (OOM/CPU) → instans planini ko'taring (Contract A38: `starter`).

**Tasdiqlash**
- `/api/health/ready` → 200; `/api/health` → `status: "ok"`.
- 10 daqiqa davomida 5xx oqimi normaga qaytdi (loglar).
- Bitta haqiqiy foydalanuvchi oqimi qo'lda tekshiriladi (login → dashboard).

**Kommunikatsiya**
- 15 daqiqadan uzoq uzilish → foydalanuvchilarga xabar (Telegram kanali).
- Sabab **texnik tafsilotsiz** aytiladi; sir/ichki manzil hech qachon yo'q.

**Hodisadan keyin**
- Sabab va tuzatma `docs/status/` ga yoziladi.
- Agar uzilishni alert **ko'rsatmagan** bo'lsa — chegara qayta ko'riladi.

---

## 2. Database uzilishi

**Aniqlash**
- `infrastructure_degraded` alerti (`db_code: db_unreachable` / `db_timeout`),
- `/api/health/ready` → 503, `checks.database.status != "ok"`.

**Darhol jilovlash**
1. **YOZISHNI TO'XTATING.** Yarim bajarilgan pul amallari eng katta xavf.
   Render → API servisini **suspend** qiling (yoki instans sonini 0 ga).
   Sabab: prepaid model atomik `updateMany` ga tayanadi; DB tebranib
   turganda takroriy urinishlar ikki marta yechish xavfini oshiradi.
2. Render → Postgres holatini tekshiring (maintenance? disk to'lgan? plan
   limiti?).

**Diagnostika**
- `checks.database.code`:
  - `db_timeout` → DB tirik, lekin sekin (pool to'lgan / og'ir so'rov / lock).
  - `db_unreachable` → ulanish yo'q (tarmoq, kredensial, servis o'chgan).
- Render Postgres metrikalarida ulanish soni va disk bandligi.

**Tiklash**
- **Sekin**: og'ir so'rovni toping va to'xtating
  (`SELECT pid, query FROM pg_stat_activity WHERE state='active'
  ORDER BY query_start`), keyin `pg_terminate_backend(pid)`.
- **Disk to'lgan**: planni ko'taring (Render Postgres → Resize).
- **Ma'lumot yo'qolgan/buzilgan**: [`backup-restore.md`](backup-restore.md)
  bo'yicha tiklash. **Tiklash — OWNER qarori.**

**Tasdiqlash**
- `/api/health/ready` → 200.
- `npx prisma migrate status` → "up to date".
- Audit-zanjir butun: `node scripts/audit-rechain.mjs --verify`.
- Pul yo'li: bitta test to'ldirish (test rejimida) → `CreditLedger` yozuvi
  paydo bo'ldi va `balanceAfter` yangi balansga teng.

**Kommunikatsiya**
- Ma'lumot yo'qolgan bo'lsa — **majburiy** foydalanuvchi xabari, yo'qotish
  oynasi (RPO) aniq ko'rsatiladi.

**Hodisadan keyin**
- RTO/RPO haqiqiy qiymatlari o'lchanadi va
  [`backup-restore.md`](backup-restore.md) ga yoziladi.

---

## 3. Redis / navbat uzilishi

**Bugungi holat: QO'LLANILMAYDI.** Redis va BullMQ repoda **hali yo'q**
(Contract A19/A20 — **Phase 6**). `render.yaml` da Redis servisi yo'q,
kodda `REDIS_URL` ishlatilmaydi.

Shu sababli bu bo'lim **ataylab bo'sh qoldirilmadi, balki chegarasi aniq
belgilandi**: Redis kiritilganda quyidagilar shu yerga yoziladi —
(1) throttler store yiqilsa rate-limit xulqi, (2) cron leader-lock
yo'qolsa ikki marta ishga tushish xavfi, (3) BullMQ navbati to'planib
qolsa. Ular kiritilmagan xizmat uchun oldindan yozilsa — yolg'on
qo'llanma bo'lardi.

Bugungi ekvivalent xavf: **cron leader-lock yo'q** (`@nestjs/schedule`
in-process). Ko'p instansda oylik billing cron'i **ikki marta** ishlashi
mumkin. Shu sababli API bugun **bitta instansda** ishlaydi va uni
ko'paytirish Phase 6 gacha **taqiqlanadi**.

---

## 4. Engine (agent-engine) uzilishi

**Aniqlash**
- `GET /api/health` → `status: "degraded"`, `checks.engine.status != "ok"`,
- foydalanuvchilar "agent javob bermayapti" deydi,
- API loglarida `engine_unavailable` (`BadGatewayException`).

**Darhol jilovlash**
- **Hech narsa to'xtatilmaydi.** Engine ixtiyoriy bog'liqlik: auth, balans,
  to'lov, admin va boshqa hamma narsa ishlayveradi. `/ready` engine'ni
  ataylab tekshirmaydi (§P5.5).

**Diagnostika**
- `checks.engine.code`:
  - `engine_timeout` → engine tirik, sekin (LLM chaqiruvi osilgan / OOM).
  - `engine_unreachable` → xususiy tarmoq yoki servis o'chgan.
  - `engine_http_5xx` → engine ichida xato → Sentry (`service: agentnet-engine`).
  - `engine_url_unset` → **konfiguratsiya xatosi**: `AGENT_ENGINE_URL` yo'q.
- Engine loglari JSON: `reqId` bo'yicha AYNI so'rovni API logi bilan solishtiring.

**Tiklash**
- Render → `agentnet-engine` → Restart.
- OOM bo'lsa: planni ko'taring yoki og'ir CV paketlari o'rnatilganini
  tekshiring (`requirements-camera.txt` prod'da o'rnatilmasligi kerak).
- LLM provayderi uzilgan bo'lsa: engine `llm_utils` orqali ikkinchi
  provayderga (Gemini) o'tadi — kalit sozlanganini tekshiring.

**Tasdiqlash**
- `/api/health` → `checks.engine.status: "ok"`.
- Bitta agent chaqiruvi uchdan-uchgacha ishlaydi.

**Kommunikatsiya**
- "AI javoblari vaqtincha ishlamayapti" — qolgan funksiyalar ishlashini
  aniq ayting (panika kamayadi).

---

## 5. To'lov xatoligi

**Aniqlash**
- `payment_failure_anomaly` alerti (15 daq oynada bekor qilingan Payme/Click
  tranzaksiyalari soni **va** ulushi chegaradan yuqori),
- yoki foydalanuvchi "pul yechildi, balans kelmadi" deydi.

**Darhol jilovlash**
1. **Balansni QO'LDA to'g'rilamang.** Har tuzatish `CreditLedger` +
   `idempotencyKey` orqali (Contract §11).
2. Provayder tomonida uzilish bo'lsa (Payme/Click statusi) — to'ldirish
   UI'sida xabar ko'rsating; **ikkinchi provayder ishlayotgan bo'lsa uni
   tavsiya qiling** (ikkita provayder aynan shu uchun bor — ADR-003).

**Diagnostika**
- Alert `facts` da: `failed`, `total`, `ratio`.
- DB: `PaymeTransaction` / `ClickTransaction` `state < 0` yozuvlari,
  `reason` / `errorCode` bo'yicha guruhlash — sabab bittami (provayder)
  yoki tarqoqmi (bizning tomonda)?
- Webhook 5xx bo'lsa → provayder qayta urinadi; loglarda
  `/api/billing/webhooks/*` yo'llarining status kodlari.

**Tiklash**
- **Provayder uzilishi** → kutish + foydalanuvchi xabari. Bizning tomonda
  o'zgarish YO'Q.
- **Bizning tomonda xato (5xx)** → tuzating, deploy qiling; provayder
  kutilayotgan tranzaksiyalarni qayta yuboradi (ikkala protokol ham
  idempotent — `paycomId` / `clickTransId` `@unique`).
- **Pul yechilgan, balans kelmagan** → tranzaksiyani provayder panelida
  tasdiqlang → admin panel orqali qo'lda kredit (§6.5 xavfli amal oqimi:
  sabab + TOTP + audit).

**Tasdiqlash**
- Yangi tranzaksiya uchdan-uchgacha o'tadi (test rejimi).
- `CreditLedger.balanceAfter` = `User.balanceTiyin`.
- Alert cooldown tugagach qayta chiqmaydi.

**Kommunikatsiya**
- Pul masalasida **individual** javob (ommaviy xabar emas), tranzaksiya
  ID bilan.

**Hodisadan keyin**
- Har bir qo'lda kredit `AuditLog` da bo'lishi **shart**. Bo'lmasa — bu
  alohida hodisa (§6).

---

## 6. Autentifikatsiya-xavfsizlik hodisasi

**Aniqlash**
- `auth_anomaly` alerti:
  - `denied_privileged > 0` → **rad etilgan impersonation urinishi**
    (bitta bo'lsa ham signal beriladi), yoki
  - `auth_failures` chegaradan oshgan (401/403 portlashi).

**Darhol jilovlash**
1. `denied_privileged > 0` bo'lsa: `AuditLog` da
   `action = 'impersonation.start.denied'` yozuvlarini oching — `actorId`
   **haqiqiy operator**. Bu ichki hisob buzilgani belgisi bo'lishi mumkin.
   → O'sha hisobning barcha sessiyalarini bekor qiling (`tokenVersion++`,
   admin panel → Users → "Sessiyalarni bekor qilish").
2. Ommaviy 401 portlashi (credential stuffing) bo'lsa: throttle
   chegaralarini vaqtincha pasaytiring (`ThrottlerModule` konfiguratsiyasi)
   va OTP yuborish limitini tekshiring.

**Diagnostika**
- Loglarda `statusCode: 401/403` bo'yicha filtr; `url` naqshi bitta
  endpointga qaratilganmi?
- `AuditLog`: `auth.otp_login`, `impersonation.start`, `admin.grant_owner`
  yozuvlari — kutilmagan `actorId` bormi?
- **Diqqat:** loglarda IP manzil YO'Q (ADR-014, PII). IP kerak bo'lsa —
  `AuditLog.metadata` va Render kirish loglari.

**Tiklash**
- Hisob buzilgan bo'lsa: `tokenVersion++`, 2FA'ni majburiy qiling,
  parol/OTP kanalini tekshiring.
- Token sizgan bo'lsa: `AUTH_JWT_SECRET` rotatsiyasi **barcha**
  sessiyalarni bekor qiladi — bu qattiq chora, OWNER qaroriga muhtoj.
- `INTERNAL_API_TOKEN` sizgan bo'lsa → §8.

**Tasdiqlash**
- Bekor qilingan sessiya bilan so'rov 401 beradi.
- Alert oynasi yopilgach qayta chiqmaydi.
- `AuditLog` zanjiri butun (`audit-rechain.mjs --verify`).

**Kommunikatsiya**
- Foydalanuvchi hisobi buzilgan bo'lsa — **individual xabar** va parol/2FA
  tiklash yo'riqnomasi.
- Platforma darajasidagi buzilish bo'lsa — mahalliy qonun talablarini
  hisobga olgan holda OWNER qaror qiladi.

---

## 7. Shifrlash kaliti hodisasi

**Aniqlash**
- `ENCRYPTION_KEY` sizdi/yo'qoldi deb gumon, yoki
- ilova `decrypt` xatolari bilan to'lib ketdi (noma'lum versiyali blob).

**Darhol jilovlash**
1. **KALITNI DARHOL ALMASHTIRMANG.** Eski kalitsiz mavjud shifrmatn
   **abadiy** yopiladi. Rotatsiya — bosqichli jarayon
   ([`secret-rotation.md`](secret-rotation.md)).
2. Kalit **sizgan** bo'lsa: shifrlangan ustunlar (konnektor tokenlari,
   2FA sirlari, brauzer sessiyalari, qo'ng'iroq yozuvlari) buzilgan deb
   hisoblanadi → foydalanuvchilarga tegishli tashqi xizmat tokenlarini
   **almashtirishni** tavsiya qiling.

**Diagnostika**
- Kalit qayerdan sizdi: git tarixi (`gitleaks` `workflow_dispatch` ishi),
  log, Sentry, screenshot, uchinchi tomon?
- Phase 5 kafolati: kalit **telemetriyaga chiqmaydi** (testlar bilan
  qulflangan — `redaction.spec.ts`, `sentry.spec.ts`). Ya'ni Sentry/log
  sizish manbai bo'lishi ehtimoldan uzoq; avval git va operator
  mashinasini tekshiring.

**Tiklash**
- To'liq tartib: [`secret-rotation.md`](secret-rotation.md)
  (`ENCRYPTION_KEY_PREVIOUS` bilan bosqichli qayta shifrlash →
  `rotate-encryption-key.mjs --apply` → `--verify`).

**Tasdiqlash**
- `node scripts/rotate-encryption-key.mjs --verify` → 0 eski-versiyali yozuv.
- Backup mashqi qayta o'tkaziladi: **yangi** kalit bilan tiklangan nusxa
  ochiladimi ([`backup-restore.md`](backup-restore.md)).

**Hodisadan keyin**
- Eski kalit bilan olingan **eski backuplar** endi yangi kalit bilan
  ochilmaydi — bu fakt yozib qo'yiladi (aks holda kelajakdagi tiklash
  jimgina yiqiladi).

---

## 8. Sir sizishi (gumon)

**Aniqlash**
- `gitleaks` topilmasi (CI `secrets` ishi yoki `workflow_dispatch` tarix skani),
- yoki sir ommaviy joyda ko'rindi (screenshot, ticket, forum).

**Darhol jilovlash — TARTIB MUHIM**
1. **Avval BEKOR QILING, keyin tozalang.** Git tarixidan o'chirish
   sirni **bekor qilmaydi** — u allaqachon nusxalangan bo'lishi mumkin.
2. Sir turiga qarab:
   | Sir | Darhol |
   |---|---|
   | `INTERNAL_API_TOKEN` | Render env-guruhda yangi qiymat → **uchala servis** qayta deploy (aks holda ichki chaqiruvlar 401) |
   | `AUTH_JWT_SECRET` | Rotatsiya = barcha sessiyalar bekor. OWNER qarori |
   | `ENCRYPTION_KEY` | §7 (bosqichli rotatsiya) |
   | `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | Provayder panelida bekor qiling → yangisi |
   | To'lov sirlari | Payme/Click panelida bekor → yangisi → webhook imzosi tekshiriladi |
   | `SENTRY_DSN` | Sentry'da DSN'ni bekor qiling (aks holda begona hodisa yuborilishi mumkin) |

**Diagnostika**
- `gitleaks detect --redact` (topilma **CI logiga chiqmaydi** — SEC-14).
- Sir qaysi commit'dan kelgan, kim ko'rgan (repo ommaviymi?).

**Tiklash**
- Yangi qiymat → deploy → eski qiymat bilan chaqiruv **rad etilishini**
  tasdiqlang.
- Git tarixini qayta yozish — **ixtiyoriy va keyingi qadam**
  ([`secret-rotation.md`](secret-rotation.md)).

**Tasdiqlash**
- Eski token bilan `/api/health` dan boshqa har qanday ichki chaqiruv 401.
- CI `secrets` ishi yashil.

---

## 9. Abnormal agent ijrosi

**Aniqlash**
- `agent_execution_failure` alerti (15 daq oynada `AutomationRun.status =
  'failed'` soni **va** ulushi chegaradan yuqori).

**Darhol jilovlash**
1. Sabab bittami? `AutomationRun.result` / `steps` da takrorlanuvchi
   xato naqshini qidiring.
2. **Xarajat himoyasi:** agar ijro LLM'ni behuda sarflayotgan bo'lsa
   (halqa), `USAGE_GLOBAL_LLM_PER_DAY` ni vaqtincha pasaytiring — bu
   platforma darajasidagi to'siq va u allaqachon mavjud.
3. Brauzer-agent bo'lsa: `MAX_CONCURRENT_RUNS` ekvivalenti hozircha yo'q
   (Phase 6, ADR-010) — kerak bo'lsa API'ni restart qiling.

**Diagnostika**
- Loglar: `reqId` bo'yicha bitta run'ning uchala servisdagi izini yig'ing.
- Sentry: `service: agentnet-engine` xatolari (5xx handler orqali keladi).
- **Prompt matni Sentry'da YO'Q** (ataylab — `[omitted:...]`). Prompt
  kerak bo'lsa u DB'dagi `Conversation`/`Message` dan olinadi (egalik
  scoping bilan, admin yo'li orqali).

**Tiklash**
- Engine xatosi → tuzatish + deploy.
- Tashqi sayt/konnektor o'zgargan → tegishli konnektorni vaqtincha
  o'chirish.
- LLM provayderi uzilgan → §4.

**Tasdiqlash**
- Yangi run muvaffaqiyatli tugaydi; alert oynasi yopiladi.

**Hodisadan keyin**
- Agar xato foydalanuvchi pulini sarflagan bo'lsa — refund
  `idempotencyKey` bilan (Contract §11).

---

## 10. Ma'lumot buzilishi (data corruption)

**Aniqlash**
- Audit-zanjir uzilgan (`audit-rechain.mjs --verify` → broken > 0),
- `CreditLedger.balanceAfter` va `User.balanceTiyin` mos emas,
- backup mashqi ogohlantirish beradi ([`backup-restore.md`](backup-restore.md)).

**Darhol jilovlash**
1. **Yozishni to'xtating** (§2 dagi kabi).
2. Buzilish doirasini aniqlang: bitta foydalanuvchimi, bitta jadvalmi,
   butun bazami?

**Diagnostika**
- Audit-zanjir uzilgan joy `seq` ni beradi → o'sha vaqtdagi deploy va
  loglarni tekshiring.
- Pul nomuvofiqligi: `CreditLedger` yozuvlari ketma-ketligini qo'lda
  qayta hisoblang (`amount` yig'indisi vs `balanceAfter`).

**Tiklash**
- Kichik doira → nuqtali tuzatish (migratsiya yoki admin endpoint, audit
  yozuvi bilan).
- Katta doira → backup'dan tiklash ([`backup-restore.md`](backup-restore.md)),
  **OWNER qarori**.
- Audit-zanjir → [`audit-chain-rechain.md`](audit-chain-rechain.md)
  (rechain **faqat** sabab aniqlangandan keyin — aks holda dalil yo'qoladi).

**Tasdiqlash**
- `audit-rechain.mjs --verify` → zanjir butun.
- Backup mashqi 0 ogohlantirish bilan o'tadi.

---

## 11. Rollback tartibi

**Qachon:** uzilish oxirgi deploy'dan keyin boshlangan bo'lsa va sabab
5 daqiqada aniqlanmasa. **Avval tiklang, keyin tushuning.**

**Tartib**
1. **Migratsiya bo'lganmi?**
   - **YO'Q** → Render → servis → Deploys → oldingi muvaffaqiyatli
     deploy → **Rollback**. Bu eng tez yo'l.
   - **HA** → **to'xtang.** Kod rollback qilingan, sxema esa yangi
     bo'lib qoladi. Migratsiya **oldinga mos** (additive) bo'lsa —
     rollback xavfsiz. Ustun/jadval **o'chirilgan** bo'lsa — rollback
     ma'lumot yo'qotadi; bu holda **oldinga tuzatish** (hotfix) yagona
     to'g'ri yo'l.
2. Rollback'dan keyin `/api/health/ready` → 200 va `prisma migrate status`
   tekshiriladi.
3. `SENTRY_RELEASE` yangi qiymatga o'zgargani uchun Sentry'da xatolar
   avvalgi relizga qaytadi — bu kutilgan.

**Rollback QILINMAYDIGAN holatlar**
- Ma'lumot o'chiruvchi migratsiya qo'llanган bo'lsa → §2/§10 (backup).
- Xavfsizlik tuzatmasi deploy qilingan bo'lsa → rollback zaiflikni
  **qayta ochadi**; oldinga tuzatish qiling.

---

## 12. Eskalatsiya

| Bosqich | Qachon | Kim |
|---|---|---|
| L1 | Alert keldi | Navbatchi muhandis (bugun = yagona muhandis) |
| L2 | 15 daqiqada tiklanmadi **yoki** pul/ma'lumot/xavfsizlik tegdi | `OWNER` |
| L3 | Ma'lumot yo'qolishi, sir sizishi, to'lov buzilishi | `OWNER` + (kerak bo'lsa) huquqiy maslahat |

**Eskalatsiya kanali:** `OWNER_ALERT_TELEGRAM_CHAT_ID` (alertlar avtomatik
tushadigan kanal). Kanal sozlanmagan bo'lsa alertlar **faqat Render
loglarida** qoladi — bu holat `docs/status/phase5-observability-audit.md`
da "production konfiguratsiyasi kerak" sifatida ochiq turibdi.

**Har eskalatsiyada beriladigan minimal ma'lumot (sirsiz):**
1. Nima buzilgan (foydalanuvchi tilida).
2. Qachon boshlangan.
3. Ta'sir doirasi (necha foydalanuvchi, pul tegdimi).
4. `request_id` yoki alert kaliti.
5. Nima qilingan.
6. Nima kerak (qaror / tasdiq).

---

## 13. Hodisadan keyingi ish (har hodisa uchun majburiy)

1. **Xronologiya** — aniqlash, jilovlash, tiklash vaqtlari (RTO o'lchovi).
2. **Sabab** — texnik, ayblovsiz.
3. **Nima ushlamadi** — alert kechikdimi? Test qamramadimi? Log yetarli
   emasmi? Har biri uchun aniq tuzatish vazifasi.
4. **Tuzatish** — kod/konfiguratsiya/hujjat o'zgarishi (commit havolasi).
5. `docs/status/` ga yozuv; alert chegarasi o'zgargan bo'lsa
   `.env.example` va shu runbook yangilanadi.

---

## 14. Free tarif budjeti

**Signal:** `free_tier_budget` (warning) — bugungi OpenRouter bepul-model
budjeti ogohlantirish chegarasidan (default 80%) o'tdi.

**Bu nima:** free tarif OpenRouter'ning `:free` modellari bilan ishlaydi.
OpenRouter limiti **hisob darajasida** `[FROM-RESEARCH]`: 20 so'rov/daqiqa
doim; kunlik 50 (hisobda umr bo'yi <$10 kredit) yoki 1000 (bir marta ≥$10
kredit sotib olingach). Butun mahsulotda bitta `OPENROUTER_API_KEY` bor,
ya'ni barcha free foydalanuvchilar shu idishdan ichadi.

**Bu NIMA EMAS:** bu uzilish emas va pullik foydalanuvchilarga **umuman
ta'sir qilmaydi** — pullik tier Anthropic zanjirida, kod darajasida
butunlay ajratilgan (`tier == "free"` shoxi, `apps/agent-engine/streaming.py`).

### Tekshirish

```bash
# Joriy holat (Redis bo'lsa)
redis-cli GET "agentnet:openrouter:free:$(date -u +%F)"
# Redis yo'q bo'lsa — Postgres fallback
psql "$DATABASE_URL" -c "SELECT count FROM \"UsageCounter\" \
  WHERE \"userId\"='_global' AND kind='openrouter_free' AND day=to_char(now() at time zone 'utc','YYYY-MM-DD');"
```

### Qaror daraxti

| Holat | Amal |
|---|---|
| 80–99% (`near`) | **Hech narsa shart emas.** Kuzatib turing — budjet ertaga UTC yarim tunda tiklanadi |
| 100% (`exhausted`) va bu birinchi marta | Kutish maqbul. Free foydalanuvchi aniq xabar oladi ("Bepul rejim bugun juda band"), pul yechilmagan, hech kim zarar ko'rmaydi |
| 100% va ketma-ket 2+ kun | **Doimiy yechim:** OpenRouter hisobiga bir martalik **$10 kredit** sotib oling → kunlik limit 50 → 1000 ga chiqadi. So'ng `OPENROUTER_FREE_DAILY_CAP=900` |
| Kutilmagan tez sarf (soatlar ichida) | Abuse tekshiruvi: `SELECT "userId", count FROM "UsageCounter" WHERE day=... AND kind='chat' ORDER BY count DESC LIMIT 20;` |

### QILMANG

- **Yangi ro'yxatdan o'tishlarni to'xtatmang.** Bu o'sish funnel'ini o'ldiradi,
  holbuki muammo vaqtinchalik va o'zi-o'zidan tiklanadi (siyosat qarori:
  `docs/strategy/SAFETY_POLICY_LAYER.md`, `alert-rules.ts` izohi).
- **Free tarifni Anthropic'ga o'tkazmang.** Bu byudjetsiz xarajat yuzasini
  ochadi — aynan shu narsadan qochish uchun butun zanjir qurilgan.
