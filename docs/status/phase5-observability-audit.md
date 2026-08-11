# Phase 5 — Observability & Operations: audit va holat

**Sana:** 2026-08-12 · **Contract:** §3 Phase 5, §5 ADR-014/ADR-015, §2 A36
**Oldingi bosqich:** [`sec15-audit.md`](sec15-audit.md) (bog'liqlik xavfsizligi)

## HOLAT: **COMPLETE** (lokal) — ikkita tashqi tasdiq **BLOKLANGAN**

Kod, testlar, buildlar va lokal mashqlar to'liq bajarildi. Ikki narsa bu
muhitda **tasdiqlab bo'lmaydi** va ular §14 da aniq vazifa sifatida ochiq
turibdi: (1) haqiqiy Sentry loyihasiga hodisa yetib borishi, (2) **prod**
bazadan tiklash mashqi. Ular "bajarildi" deb **atalmagan**.

---

## 1. Aniq commitlar

| Commit | Mavzu |
|---|---|
| `c1a6f0d` | `chore(deps)` — Sentry va pino bog'liqliklari (api/web/engine) |
| `6c9bece` | `feat(api)` — Sentry, pino JSON loglar, request-id, chuqur `/api/health`, 4 alert |
| `e532c54` | `feat(web)` — Sentry (server/edge/klient), `global-error`, BFF request-id |
| `790f9da` | `feat(engine)` — Sentry, strukturaviy JSON log, request-id |
| `db8742e` | `fix(api)` — **P5.8 topilmalari**: OTP logi fail-closed, email/PII maskalandi |
| `6233afa` | `feat(ops)` — backup/restore mashqi, ikki runbook, prod konfiguratsiyasi |

Bazaviy nuqta: `efc4e7a` (SEC-15). **50 fayl, +6404 / −59** (`package-lock.json`siz).

---

## 2. O'zgargan fayllar

**Yangi (34)**

| Guruh | Fayllar |
|---|---|
| API kuzatuv | `observability/{redaction,sentry,logger.config,request-id,request-id.middleware,observability.module}.ts` |
| API alertlar | `observability/alerts/{alert.types,alert.service,alert-rules,alert-counters,alert-evaluator.service}.ts` |
| API health | `health/{health.service,health.controller,health.module}.ts` |
| API testlar | `observability/{redaction,sentry,request-id,logger.config,observability-config,leakage-review}.spec.ts`, `observability/alerts/alerts.spec.ts`, `health/health.service.spec.ts` |
| API skript | `scripts/backup-restore-drill.mjs` |
| Web | `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/app/global-error.tsx`, `src/lib/observability/{scrub,request-id}.ts` |
| Engine | `observability.py`, `test_observability.py` |
| Hujjat | `docs/runbooks/{incident-response,backup-restore}.md`, shu fayl |

**O'zgargan (15)**

`.env.example` · `render.yaml` · `package-lock.json` · `apps/api/package.json` ·
`apps/web/package.json` · `apps/agent-engine/requirements.txt` ·
`apps/agent-engine/main.py` · `apps/api/src/main.ts` · `app.module.ts` ·
`common/all-exceptions.filter.ts` · `common/engine-auth.ts` ·
`auth/email.service.ts` · `auth/sms.service.ts` ·
`apps/web/src/middleware.ts` · `apps/web/src/lib/security-headers.ts` ·
`apps/web/next.config.ts`

**O'chirilgan (1):** `apps/api/src/health.controller.ts` → `health/` moduliga ko'chdi.

---

## 3. Sentry ×3 (P5.1)

### Nima uchun `@sentry/node`, `@sentry/nestjs` EMAS

`@sentry/nestjs` o'zining `SentryGlobalFilter`ini global `APP_FILTER`
sifatida qo'yishni talab qiladi. Repoda allaqachon `AllExceptionsFilter`
bor va u **HTTP javob shartnomasini belgilaydi** (SEC-08 413 yo'li,
`reason` kodlari, 5xx tafsilotini yashirish). Ikkinchi global filtr yo
tartib ziddiyatiga, yo **har xatoni ikki marta yuborishga** olib kelardi.
Yechim: SDK'ning o'zi ishlatiladi, yuborish esa **mavjud filtrdan bir
marta**. Javob shakli o'zgarmadi (mavjud `all-exceptions.filter.spec.ts`
o'zgarishsiz o'tadi).

### Uch servis, uch xil ehtiyoj

| Servis | Ushlash nuqtasi | O'ziga xos qaror |
|---|---|---|
| **API** | `AllExceptionsFilter` → **faqat 5xx** | 4xx yuborilmaydi (validatsiya xatolari kuniga minglab — signal shovqinga ko'milardi) |
| **Web** | `instrumentation.ts` (Node **+ Edge**), `onRequestError`, `global-error.tsx` | **Edge alohida**: `middleware.ts` (BFF) o'sha runtime'da ishlaydi va server konfiguratsiyasi u yerga yetib bormaydi — BFF xatolari ko'rinmasdi. `global-error` — React RENDER xatolari (ular global handler'ga umuman yetmaydi) |
| **Engine** | `HTTPException` handler → **5xx** | 44 endpoint xatoni `except → raise HTTPException(500)` bilan **ushlaydi**, ya'ni SDK'ning avtomatik integratsiyasi ularni ko'rmasdi. 44 faylni o'zgartirish o'rniga bitta handler; u FastAPI'ning O'Z handler'ini chaqirib javobini o'zgarishsiz qaytaradi |

### Ixtiyoriylik (DoD talabi)

Uchala servisda ham: **DSN yo'q → `Sentry.init` UMUMAN chaqirilmaydi.**
SDK "o'chirilgan" holatda qoladi va har `capture*` no-op bo'ladi.
`NODE_ENV=test` / pytest ichida DSN bo'lsa ham yoqilmaydi.
`SENTRY_ENABLED=0` — operator uchun favqulodda o'chirgich.
Testlar: `sentry.spec.ts` (7), `test_observability.py` (6),
`observability-config.spec.ts` (uchala web konfiguratsiyasi uchun).

### Sir chegaralari (har biri test bilan qulflangan)

| Chora | Qayerda |
|---|---|
| `sendDefaultPii: false` / `send_default_pii=False` | 5 ta konfiguratsiya faylining hammasida |
| `includeLocalVariables: false` | API — dekriptlangan konnektor kredensiali aynan frame'da ko'rinardi |
| `beforeSend` chuqur tozalash | Hammasi (`redaction.ts` / `scrub.ts` / `observability.py`) |
| Cookie butunlay almashtiriladi | `agentnet_token`, `agentnet_imp` = sessiya va impersonation tokeni |
| Foydalanuvchidan **faqat `id`** | email/telefon/IP/username tashlanadi |
| **Prompt BUTUNLAY o'chiriladi** | Engine — `[omitted:<tur>:<uzunlik>]` (tozalash emas, o'chirish) |
| Session Replay **yo'q** | Web klient — u DOM'ni yozadi: chat matni, balans, telefon |
| `tunnelRoute` **yo'q** | Autentifikatsiyasiz uzatuvchi ochiq proxy = SSRF yuzasi |
| Klient DSN **alohida env** | Server DSN'i brauzer bundle'iga hech qachon tushmaydi |

### Source map (prod uchun xavfsiz)

`deleteSourcemapsAfterUpload: true` — map'lar Sentry'ga yuklanib, build
chiqishidan **o'chiriladi** (manba kodi ommaviy URL'da qolmaydi).
`SENTRY_AUTH_TOKEN` bo'lmasa plagin **butunlay o'chadi**: `@sentry/cli`
postinstall skripti `allowScripts` ro'yxatiga **ataylab qo'shilmagan**
(ta'minot-zanjiri qarori), ya'ni token'siz muhitda CLI ikkilik fayli yo'q
va plaginni o'chirish **shart**, ixtiyoriy emas.

### CSP ta'siri

`browserApiOrigins()` endi Sentry ingest origin'ini qaytaradi — lekin
**fail-closed**: faqat `NEXT_PUBLIC_SENTRY_DSN` sozlangan va **yaroqli
URL** bo'lganda. Origin DSN'ning **o'zidan** olinadi (`new URL(dsn).origin`),
qo'lda satr emas. DSN yo'q → SEC-13 siyosati avvalgidek qat'iy.

---

## 4. Strukturaviy log (P5.2, ADR-014)

`nestjs-pino` + `pino`. **Prod** — bitta qatorli JSON; **dev** —
`pino-pretty`; **test** — `silent`.

**Majburiy maydonlar:** `level` (nom, raqam emas), `time` (ISO-8601),
`service`, `env`, `reqId`, `method`, `url`, `statusCode`, `responseTime`,
`err.type`, `err.code`.

### Uch toifa log ARALASHTIRILMADI

| Toifa | Qayerda | Phase 5 da |
|---|---|---|
| Operatsion | pino (HTTP, davomiylik, xato) | **yangi** |
| Xavfsizlik / audit | `AuditLog` **jadvali**, hash-zanjir (ADR-008) | **umuman tegilmadi** |
| Biznes hodisalari | servislardagi mavjud `Logger` chaqiruvlari | faqat **formati** JSON bo'ldi |

`app.useLogger(app.get(PinoLogger))` mavjud `new Logger(...)` larni
**almashtirmaydi** — ularning chiqish formatini o'zgartiradi. Hech bir
biznes yoki audit logi o'chirilmadi va qayta yozilmadi.

### Redaksiya — ikki qatlam

1. **pino `redact`** — arzon, oldindan aytilgan yo'llar bo'yicha
   (`req.headers.authorization`, `*.refreshToken`, ...).
2. **`hooks.logMethod` chuqur skan** — `redact` faqat *ma'lum* yo'llarni
   biladi; biror servis `logger.error(\`...${token}...\`)` yozsa yoki
   kutilmagan shakldagi obyekt bersa, u **ko'rmaydi**. Bu hook har
   argumentni (satr — naqsh bo'yicha, obyekt — nom+qiymat bo'yicha)
   o'tkazadi.

**So'rov serializatori sarlavhalarni UMUMAN chiqarmaydi** (ro'yxat
bo'yicha emas — butunlay): kerakli yagona sarlavha request-id, u alohida
maydonda. Bu "yangi sir-sarlavha turi qo'shilganda ro'yxatni yangilashni
unutish" xatosini **strukturaviy jihatdan imkonsiz** qiladi.
**IP manzil yozilmaydi** (ADR-014: PII); tergov uchun IP `AuditLog`
metadata'sida qoladi.

**Isbot (konfiguratsiya emas, HAQIQIY chiqish):**
`logger.config.spec.ts` da haqiqiy pino instansi quriladi va **chiqqan
satr** o'qiladi — `INTERNAL_API_TOKEN`, `ENCRYPTION_KEY`, JWT, Bearer va
chuqur joylashgan `apiKey` chiqishda **yo'q**.

---

## 5. Request-ID oqimi (P5.3)

```
Brauzer ──(x-request-id, sukut bo'yicha ISHONILMAYDI)──► Next BFF
   BFF: kanonik ID hal qiladi ──set()──► x-request-id ──► NestJS API
   API: format bo'yicha qabul qiladi ──► ALS konteksti
   ALS ──► axios interceptor ──► x-request-id ──► Agent Engine
   Engine: yuqori oqim ID sini SAQLAYDI
   Har uchtasi: log maydoni + `X-Request-Id` javob sarlavhasi
```

| Bosqich | Kiruvchiga ishonch | Sabab |
|---|---|---|
| BFF (web) | **YO'Q** (`TRUST_CLIENT_REQUEST_ID=1` bilan yoqiladi) | Yuqori oqim — **anonim brauzer** |
| API | Format mos bo'lsa **HA** (`TRUST_INCOMING_REQUEST_ID=0` bilan o'chadi) | Yuqori oqim — **bizning O'Z BFF'imiz** |
| Engine | Format mos bo'lsa **HA** | Engine ommaviy emas (SEC-10: `pserv` + ichki token) |

**Format:** `^[A-Za-z0-9_-]{8,64}$` (uchala servisda **aynan bir xil**).
Bu bloklaydi: `\r`/`\n` (**log-injection**), bo'shliq, `<`/`>`, 64 dan
uzun qiymat, takrorlangan sarlavha (massiv). Yaroqsiz qiymat
**hech qayerga** (log, sarlavha, javob) tushmaydi — u hal qilish
funksiyasida o'ladi.

**Nima almashtirildi:** `main.ts` da 3 qatorlik **tekshiruvsiz** blok bor
edi (`req.headers['x-request-id'] || randomUUID()`). U ishlardi, lekin
mijoz 100 KB'lik yoki `\n` bilan to'la sarlavha yubora olardi, BFF va
engine'da esa umuman yo'q edi — zanjir uzilardi.

**API → engine propagatsiyasi AsyncLocalStorage orqali.** Sabab: 13+
engine chaqiruv-nuqtasi `Request` obyektini ko'rmaydi; har biriga `req`
uzatish observability uchun **biznes kodiga tegish** bo'lardi. Mavjud
yagona axios interceptor ID'ni o'zi oladi — **birorta biznes fayli
o'zgarmadi**. Kontekst bo'lmaganda (cron) sarlavha **qo'yilmaydi**:
soxta ID zanjirni yolg'on qilardi.

**Testlar (26):** yaratish · yaroqli qiymat · yaroqsiz · **ulkan (100 KB)** ·
massiv · ishonch o'chirilgan · javob sarlavhasi · **parallel so'rovlar
kontekstlari aralashmasligi** · API→engine · **kontekstsiz chaqiruvda ID
qo'yilmasligi** · **engine BO'LMAGAN manzilga ID ham, ichki token ham
ketmasligi** · engine HTTP integratsiyasi (yuqori oqim ID saqlanishi,
yaroqsizi javobga tushmasligi).

---

## 6. To'rtta alert (P5.4)

**Hech qanday soxta metrika yo'q** — har signal bugun mavjud ustun yoki
haqiqiy HTTP javobidan oziqlanadi.

| # | Kalit | Signal (manba) | Chegara | Oyna | Jiddiylik | Sovish |
|---|---|---|---|---|---|---|
| 1 | `payment_failure_anomaly` | `PaymeTransaction.state < 0` + `ClickTransaction.state < 0` | ≥5 **va** ulush ≥50% | 15 daq | `critical` | 60 daq |
| 2 | `agent_execution_failure` | `AutomationRun.status = 'failed'` | ≥5 **va** ulush ≥50% | 15 daq | `high` | 60 daq |
| 3 | `infrastructure_degraded` | `HealthService` DB tekshiruvi **yoki** 5xx hisoblagichi | 2 ketma-ket **yoki** ≥20 5xx | 5 daq | `critical` | 30 daq |
| 4 | `auth_anomaly` | 401/403 hisoblagichi + `AuditLog` `impersonation.start.denied` | ≥100 **yoki** ≥1 rad etilgan imtiyozli | 15 daq | `high` | 60 daq |

**Nega "son VA ulush" birga:** faqat ulush bo'lsa — 1 dan 1 xato = 100%
→ har tungi yolg'on signal. Faqat son bo'lsa — 600 tadan 6 xato normal
shovqin. Ikkalasi birga bo'lgandagina signal **haqiqiy anomaliyani**
bildiradi. Rad etilgan **imtiyozli** urinish esa bitta bo'lsa ham signal
beradi — u "parolni unutdim" shovqini emas.

**Yetkazish — mavjud infratuzilma qayta ishlatildi** (yangi monitoring
platformasi kiritilmadi): `TelegramService` (SEC-11 dagi **ayni**
`OWNER_ALERT_TELEGRAM_CHAT_ID`) + Sentry `captureMessage` + strukturaviy
log. **Soxta muvaffaqiyat yo'q:** kanal sozlanmagan bo'lsa
`delivered: false, reason: 'no_channel_configured'`. **Cooldown faqat
HAQIQIY yuborishdan keyin boshlanadi** — aks holda muvaffaqiyatsiz
urinish keyingi (ehtimol muvaffaqiyatli) signalni bir soatga bloklardi.

**Payload sirsiz:** faqat sonlar va kodlar; `formatMessage` chiqishi
`scrubText` dan ham o'tadi (ikki qatlam). Test buni `facts` ga ataylab
sir qo'yib tekshiradi.

**Ma'lum cheklov (yashirilmagan):** dedup/cooldown va 401/403/5xx
hisoblagichlari **jarayon ichida**. Bugun API bitta instansda
(`render.yaml`, `plan: free`) — amalda cheklov emas. Instans soni oshsa:
takroriy signal va chegaralarning bo'linishi. Taqsimlangan hisob Redis
talab qiladi — **Phase 6** (ADR-006). Runbook §0 da yozilgan.

**Runbook bog'lanishi:** har alert `ALERT_DEFINITIONS[...].runbook` orqali
`incident-response.md` ning aniq bo'limiga ishora qiladi; test har
to'rttasining anchor formatini qulflaydi.

---

## 7. Health endpointlari (P5.5)

| Endpoint | Nima tekshiradi | Kod | Throttle |
|---|---|---|---|
| `/api/health/live` | Jarayon tirik. **I/O YO'Q** | doim 200 | `@SkipThrottle` |
| `/api/health/ready` | Postgres + kritik konfiguratsiya | 200 / **503** | `@SkipThrottle` |
| `/api/health` | Diagnostik xulosa (+ engine) | 200 / 503 | 30/daq |

**Nega `/live` bog'liqliklarga tegmaydi:** orkestrator uni **qayta ishga
tushirish** qarori uchun ishlatadi. Agar u DB'ni tekshirsa, DB uzilganda
butun park cheksiz restart tsikliga tushardi — DB'ni tiklash o'rniga
**halokat kuchaytirgichi**.

**Nega engine `ready` da YO'Q:** engine yiqilsa AI javoblari ishlamaydi,
lekin auth, balans, to'lov, admin — hammasi ishlaydi. Uni majburiy qilish
kichik uzilishni **to'liq uzilishga** aylantirardi. `/api/health` da u
`degraded` (200) beradi.

**`render.yaml` `healthCheckPath`: `/api/health` → `/api/health/ready`.**
Render bu maydonni **deploy darvozasi** sifatida ishlatadi ("bu instansga
trafik yuborsam bo'ladimi?") — bu aynan readiness savoli. Ilgari DB'siz
yoki env'i chala instans ham 200 qaytarib live bo'lardi.

**DDoS emas:** `/live` I/O qilmaydi; `/ready` va `/` natijasi
`HEALTH_CACHE_MS` (default 5s) davomida **keshlanadi** — sekundiga 10 000
so'rov ham DB'ga sekundiga **bitta** `SELECT 1` beradi; har tekshiruvda
**timeout** bor (osilgan DB healthcheck'ni osintirmaydi). So'rov ataylab
eng arzoni — `count()` kabi qimmat so'rov yo'q.

**Javobda YO'Q:** ulanish satri, host, port, foydalanuvchi nomi, token,
kalit, stack-trace, DB xato matni, **yetishmayotgan env kaliti nomi**
(faqat `config_missing_<son>` — qaysi himoya o'chiqligi ham razvedka).
To'liq xato **server logida** qoladi.

**Mavjud shartnoma saqlandi:** `/api/health` hamon `{status, service, ts}`
beradi (qo'shimchalar bilan).

**Testlar (22):** hammasi sog'lom · DB yo'q · DB timeout · engine yo'q ·
engine timeout · engine sozlanmagan · buzuq konfiguratsiya · kesh ishlashi ·
kesh muddati · **javobda sir yo'qligi**.

---

## 8. Backup / restore mashqi (P5.6)

**Skript:** `apps/api/scripts/backup-restore-drill.mjs` ·
**Runbook:** [`docs/runbooks/backup-restore.md`](../runbooks/backup-restore.md)

**Audit natijasi:** Render `starter` avtomatik kunlik backup qiladi, lekin
repoda **hech qanday backup/restore kodi yoki hujjati yo'q edi** va
tiklash **hech qachon sinab ko'rilmagan** edi.

**Lokal mashq BAJARILDI (2026-08-11, Postgres 16, `agentnet_dev`):
17/17 tekshiruv o'tdi.**

```
✅ Backup 259.9 KB · ✅ izolyatsiyalangan bazaga tiklandi
✅ Sxema 46/46 jadval · ✅ migratsiya tarixi aynan ko'chdi (33)
✅ User 19 · Agent 14 · CreditLedger 10 · AuditLog 36 · Conversation 2 (mos)
✅ Shifrlangan ma'lumot JORIY kalit bilan ochildi (1/1)
✅ Audit-zanjir butun (36/36)  ✅ vakil yozuvlar o'qiladi
```

**Eng muhim tekshiruv — shifrlangan ma'lumot.** Damp to'liq bo'lsa ham,
`ENCRYPTION_KEY` yo'qolgan bo'lsa konnektor tokenlari, 2FA sirlari va
brauzer sessiyalari **abadiy** ochilmaydi. Backup strategiyasi **ikki
qismdan** iborat (ma'lumot + kalit) va ular alohida saqlanadi.

**Xavfsizlik:** manba bazaga hech qachon yozilmaydi; `DROP DATABASE`
faqat skript o'zi yaratgan `agentnet_drill_*` bazasiga (prefiks qat'iy);
prod manba bloklangan; parol/kalit/**ochiq matn** hech qachon chiqarilmaydi.

### Mashq topgan ikki anomaliya (manba ma'lumotida — damp aybdor emas)

1. **Orqaga qaytarilgan migratsiya yozuvi** —
   `20260809220000_sec12_impersonation_and_user_write_actions`
   `_prisma_migrations` da ikki marta (biri `rolled_back_at` bilan).
   Sxema to'g'ri, `migrate status` "up to date" — ya'ni **lokal dev
   artefakti**. Prod'da tekshirish SQL'i runbook §5 da.
2. **Balans / ledger nomuvofiqligi (1/4 foydalanuvchi)** —
   `User.balanceTiyin` (50 000 000) oxirgi `CreditLedger.balanceAfter`
   (31 100 000) bilan mos emas. Deyarli aniq **lokal dev seed/qo'lda
   tahrir** izi. **Prod xatosi deb DA'VO QILINMAYDI — tekshirilmagan.**
   Prod'da tekshirish SQL'i runbook §5 da; natija bo'sh bo'lmasa — hodisa.

**RTO/RPO farazlari (sinovdan o'tgan prod kafolati EMAS):**
RPO ≤ 24 soat (Render `starter` kunlik backup; point-in-time tiklash
`starter` da **yo'q** — haqiqiy cheklov). RTO 30–60 daqiqa (lokal damp
< 20 soniya; prod'da asosiy vaqt — yangi baza va qayta ulash).

---

## 9. Incident runbook (P5.7)

[`docs/runbooks/incident-response.md`](../runbooks/incident-response.md) —
13 bo'lim, har biri **Aniqlash → Jilovlash → Diagnostika → Tiklash →
Tasdiqlash → Kommunikatsiya → Hodisadan keyin**.

Qamrov: ilova uzilishi · **DB uzilishi** · Redis/navbat · **engine
uzilishi** · **to'lov xatoligi** · **auth/xavfsizlik hodisasi** ·
**shifrlash kaliti hodisasi** · **sir sizishi** · **abnormal agent
ijrosi** · **ma'lumot buzilishi** · **rollback** · **eskalatsiya** ·
hodisadan keyingi ish.

**RBAC hurmat qilindi:** OWNER — yagona eskalatsiya va tiklash tasdig'i;
ADMIN — diagnostika + §6.5 xavfli amal **so'rovi**; SUPPORT — faqat
o'qish, hech qanday tiklash amali yo'q.

**Redis/navbat bo'limi ataylab "QO'LLANILMAYDI"** deb belgilandi — ular
repoda hali yo'q (Phase 6). Mavjud bo'lmagan xizmat uchun qo'llanma
yozish **yolg'on hujjat** bo'lardi. O'rniga bugungi ekvivalent xavf aniq
yozildi: **cron leader-lock yo'q** → oylik billing cron'i ko'p instansda
ikki marta ishlashi mumkin → **API bugun bitta instansda va uni
ko'paytirish Phase 6 gacha taqiqlanadi**.

---

## 10. Xavfsizlik ko'rigi (P5.8)

Ko'rik **test sifatida** yozildi (`leakage-review.spec.ts`) — bir martalik
hujjat eskiradi, test har CI'da qayta bajariladi. Qamrov: `apps/api/src`,
`apps/web/src` + web ildiz konfiguratsiyalari, `apps/agent-engine` (test
fayllari chiqarilgan).

### Topilgan va TUZATILGAN (commit `db8742e`)

| # | Topilma | Jiddiylik | Tuzatma |
|---|---|---|---|
| 1 | **OTP kodi noto'g'ri sozlangan prod'da logga tushardi.** Shart `NODE_ENV === 'production'` edi — `NODE_ENV` **umuman qo'yilmagan** muhitda kod "DEV" tarmog'iga tushib, bir martalik login kodini ochiq matnda yozardi | **Yuqori** | Fail-closed: log faqat aniq `development`/`test` da |
| 2 | **Email manzili prod logida** (`...so'raldi (${email})`) — ADR-014 buzilishi | O'rta | `maskEmail()`: `a***@domain` |
| 3 | **Eskiz javob tanasi to'liq loglanardi** — boshqarilmaydigan uchinchi-tomon payload'i (ichida telefon raqami) | Past-o'rta | 300 belgiga qisqartirildi; sir shakllari pino qatlamida kesiladi |

### Tekshirilgan va TOZA

`ENCRYPTION_KEY` · `INTERNAL_API_TOKEN` · `AUTH_JWT_SECRET` · JWT/sessiya
tokeni · refresh/impersonation tokeni · LLM kalitlari · to'lov sirlari ·
konnektor kredensiallari · dekriptlangan qiymatlar — **hech biri** log,
Sentry breadcrumb, Sentry kontekst, health javobi, xato xabari, alert
payload'i, so'rov sarlavhasi/tanasi yoki tracing metadata'siga chiqmaydi.

Avtomatik gate'lar: sir qiymati log chaqiruviga uzatilmasligi · DSN/kalit
qotirilmasligi · `sendDefaultPii: true` yo'qligi · `includeLocalVariables`
yoqilmaganligi · health javobi sirsizligi · 5xx javobi umumiy xabarligi ·
Sentry faqat 5xx uchun chaqirilishi (**dublikat yo'q**).

### Qoldiq (tuzatilmagan, ataylab)

- `token.util.ts:78` — `console.warn` (pino'dan tashqarida). **Sir
  yozmaydi** (faqat `AUTH_JWT_SECRET` yo'qligi haqida ogohlantirish) va
  sof util'ga Nest logger'ini kiritish observability uchun biznes kodiga
  tegish bo'lardi. Xavfsizlik ta'siri: **yo'q**.
- `AdminAlertService` (SEC-11) signal matnida operator va nishon
  **emailini** yozadi. Bu **ataylab**: u nazorat signali va aynan
  kimligini bilish uning maqsadi. O'zgartirilmadi (biznes xulqi).

---

## 11. Testlar va natijalar

| Tekshiruv | Bazaviy (`efc4e7a`) | Hozir | Natija |
|---|---|---|---|
| `prisma validate` | ✅ | ✅ | o'tdi |
| `prisma migrate status` | 33 migratsiya, toza | 33 migratsiya, toza | **yangi migratsiya YO'Q** |
| `tsc --noEmit` (api) | ✅ | ✅ | o'tdi |
| `eslint` (api) | 0 xato / 9 ogoh. | **0 xato / 8 ogoh.** | 1 ogohlantirish kamaydi |
| `jest` (api) | 60 to'plam / **746** test | **68 to'plam / 939 test** | **+193 test**, 0 muvaffaqiyatsiz |
| `nest build` | ✅ | ✅ | o'tdi |
| `tsc --noEmit` (web) | ✅ | ✅ | o'tdi |
| `eslint` (web) | 0 xato / 170 ogoh. | 0 xato / 170 ogoh. | o'zgarmadi |
| `next build` | ✅ | ✅ | o'tdi (35 sahifa) |
| `ruff check` (engine) | ✅ | ✅ | o'tdi |
| `pytest` (engine) | **14** | **43** | **+29 test** |
| `mypy` (yangi fayllar) | — | ✅ toza | o'tdi |
| `npm audit --audit-level=high` | ⛔ 9 high | ⛔ **9 high** | **yangi high YO'Q** (§13.1) |
| `pip-audit` (sentry-sdk) | — | ✅ 0 zaiflik | o'tdi |
| **backup/restore mashqi** | mavjud emas | ✅ **17/17** | lokal bajarildi |

**Yangi testlar taqsimoti (222):**
redaksiya 24 · Sentry (api) 17 · request-id (api) 26 · pino 29 ·
health 22 · alertlar 27 · konfiguratsiya qulfi 50 · sizish ko'rigi 11 ·
engine 29 (redaksiya, prompt o'chirish, Sentry, request-id, auth
regressiyasi).

**Hech qanday gate yumshatilmadi.** `|| true` yo'q, `continue-on-error`
yo'q, `skip`/`todo` yo'q, o'chirilgan xavfsizlik testi yo'q,
"tekshiruvni o'tkazish uchun" yozilgan soxta mock yo'q. Mavjud 746
testning **hammasi o'zgarishsiz** o'tadi.

---

## 12. Buildlar va migratsiyalar

**Buildlar:** `nest build` ✅ · `next build` ✅ (35 sahifa; middleware
41.9 kB — Sentry Edge SDK hisobiga o'sdi) · engine importlari ✅.

**Migratsiya: YANGI MIGRATSIYA QO'SHILMADI.** Bu ataylab — kuzatuv
qatlami hech qanday sxema o'zgarishini talab qilmadi. Alertlar mavjud
ustunlardan (`PaymeTransaction.state`, `ClickTransaction.state`,
`AutomationRun.status`, `AuditLog.action`) o'qiydi. DoD: *"no migration
is added unless genuinely required"* — bajarildi.

---

## 13. Qolgan risklar

### 13.1 `npm audit` gate'i QIZIL (SEC-15 dan meros, Phase 5 sababi emas)

9 ta high zaiflik **SEC-15 dan beri ochiq** (`next`, `sharp`, `postcss`,
`picomatch`, `nanoid`, `multer`, `lodash`, `js-yaml`). Phase 5 **birorta
high qo'shmadi** (9 → 9).

Jami 19 → 21: `webpack` va `ajv` `@sentry/nextjs` ning webpack-plagini
(peer) orqali prod daraxtiga tushdi. Ikkalasi ham **moderate/low** va
advisory'lari **build vaqtidagi** xulq haqida (`buildHttp` SSRF, `$data`
ReDoS) — ish-vaqtida bajarilmaydi. Bloklovchi gate (`--audit-level=high`)
**ta'sirlanmadi**.

> **MUHIM YANGILIK:** SEC-15 npm tuzatmasini "bu muhitda `npm install`
> ishlamaydi" deb bloklangan qoldirgan edi. **Bugun `npm install` ishlaydi
> va tekshirildi** (Phase 5 bog'liqliklari aynan shu bilan qo'shildi).
> Ya'ni SEC-15 §8 dagi tayyor retsept endi **qo'llanishi mumkin**. Bu
> Phase 5 ishi emas — alohida vazifa (§14).

### 13.2 `npm ci` lockfile bilan sinxron emas (PRE-EXISTING, CI'ni buzadi)

`npm ci` `Missing: @nut-tree/nut-js@ from lock file` bilan yiqiladi.
**Bazaviy commitda ham AYNAN shunday** — izolyatsiyalangan nusxada HEAD
lockfile'i bilan tasdiqlandi. Sabab: `apps/companion-desktop` ning
`optionalDependencies` idagi `@nut-tree/nut-js` ommaviy registrda
**404** (paket yopiq registrga ko'chgan), shuning uchun lockfile'da unga
yozuv yo'q. **Phase 5 regressiyasi emas**, lekin CI'ning barcha `npm ci`
qadamlariga ta'sir qiladi. Tuzatma (§14).

### 13.3 Alert va hisoblagichlar bitta jarayonda

Dedup/cooldown va 401/403/5xx hisoblagichlari jarayon ichida. Bugun API
bitta instansda — amalda ta'sir yo'q. Instans soni oshsa: takroriy
signal + chegaralarning bo'linishi. Taqsimlangan hisob → **Phase 6**
(Redis, ADR-006). Cron ham leader-lock'siz (A24).

### 13.4 `mypy` da 3 ta pre-existing xato (`llm_utils.py`)

`llm_utils.py` da 3 ta `union-attr` xatosi **lokal muhitda** ko'rinadi.
Fayl **o'zgartirilmagan** (`git status` bilan tasdiqlangan) va xatolar
uchinchi-tomon SDK versiyalarining lokal drift'idan kelib chiqadi
(lokal Python 3.14 vs CI 3.11). Yangi fayllar (`observability.py`,
`main.py`) mypy'da **toza**. CI'da bu xatolar ko'rinsa — u **Phase 5 dan
oldin ham** shunday bo'lgan.

### 13.5 `pip-audit` lokal muhitda ishlamaydi

`numpy==2.2.1` lokal Python 3.14 da qurilmaydi → `pip-audit -r
requirements.txt` yiqiladi. **Bazaviy `requirements.txt` bilan ham aynan
shunday** (tasdiqlangan). CI Python 3.11 ishlatadi — u yerda ishlaydi.
`sentry-sdk==2.67.1` alohida auditdan o'tkazildi: **0 zaiflik**.

### 13.6 Sentry hodisasi HECH QACHON haqiqiy loyihaga yuborilmagan

Barcha Sentry mantig'i (init sharti, `beforeSend` tozalash, 5xx ushlash)
**unit testlar** bilan qoplangan, lekin haqiqiy DSN bilan **jonli
yuborish sinovdan o'tmagan**. Bu — muhit cheklovi, kod cheklovi emas.

### 13.7 Web tomonida test infratuzilmasi yo'q

`apps/web` da jest **ataylab** yo'q (Phase 1 qarori). Web Sentry va
`scrub.ts` mantig'i **bevosita** unit-testlanmaydi; uning o'rniga
**konfiguratsiya invariantlari** `apps/api` dan matn ustidan qulflangan
(`observability-config.spec.ts`, 50 ta tekshiruv) — SEC-14/SEC-15 dagi
bilan bir xil naqsh. Bu **teng qiymatli emas** va shunday deb yozilgan.

### 13.8 `@sentry/cli` postinstall bloklangan

`allowScripts` ga qo'shilmadi (ta'minot-zanjiri qarori). Natija:
source-map yuklash **faqat** `SENTRY_AUTH_TOKEN` bo'lgan muhitda ishlaydi
va u muhitda `npm install` `@sentry/cli` ni yuklab olishi kerak. Aks
holda stack-trace'lar Sentry'da **minifikatsiyalangan** ko'rinadi.

---

## 14. Production konfiguratsiyasi — hali KERAK

| # | Nima | Qayerda | Holat |
|---|---|---|---|
| 1 | Sentry loyihalari yaratish (3 ta: api / web / engine) | sentry.io | **BLOKLANGAN** — tashqi xizmat |
| 2 | `SENTRY_DSN` (api, web-server, engine) | Render → Environment (`sync: false`) | kutilmoqda |
| 3 | `NEXT_PUBLIC_SENTRY_DSN` (brauzer) | Render/Vercel → web | kutilmoqda |
| 4 | `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` (source map) | web build muhiti | kutilmoqda |
| 5 | `SENTRY_RELEASE` = git SHA | deploy skripti | kutilmoqda |
| 6 | **`OWNER_ALERT_TELEGRAM_CHAT_ID`** — busiz alertlar faqat logda qoladi | Render → API | **kutilmoqda** |
| 7 | **Prod'dan bir martalik bazaga tiklash mashqi** | Render + operator | **BLOKLANGAN** — bajarilmagan |
| 8 | `ENCRYPTION_KEY` offline nusxasi (parol menejeri) | OWNER | tekshirilishi kerak |
| 9 | Render `healthCheckPath` yangi qiymati bilan deploy | Render | keyingi deploy'da |
| 10 | Prod'da §8 dagi ikki SQL tekshiruvi | Postgres | kutilmoqda |

**"Jonli tasdiqlangan" DEB DA'VO QILINMAYDI:** Sentry hodisasi, alert
Telegram xabari va prod tiklash mashqi — uchalasi ham faqat **lokal**
darajada tekshirilgan.

---

## 15. Keyingi aniq vazifa

**Phase 5 tugadi. Phase 6 (Runtime Decoupling) boshlanishidan OLDIN
ikkita mustaqil, kichik vazifa bor** — ikkalasi ham CI'ni yashil holatga
qaytaradi va ular Phase 5 ishi emas:

1. **SEC-15 npm retseptini qo'llash** (endi mumkin — §13.1):
   ildiz `package.json` ga `overrides` (`js-yaml`, `lodash`, `multer`,
   `picomatch`, `postcss`, `sharp`), `apps/web` da `next` ni `^15.5.23`
   ga ko'tarish, `npm install`, so'ng `npm audit --omit=dev
   --audit-level=high` (0 high kutiladi) + to'liq test/build regressiyasi.
2. **`npm ci` sinxronligini tiklash** (§13.2): `apps/companion-desktop`
   dagi erishib bo'lmaydigan `@nut-tree/nut-js` `optionalDependencies`
   yozuvini olib tashlash (paket 404 va u hech qachon o'rnatilmagan;
   `companion.mjs` allaqachon uning yo'qligiga chidamli — README'da
   "degrades to stub warnings" deb yozilgan), so'ng `npm install` va
   izolyatsiyada `npm ci` bilan tasdiqlash.

**Shundan keyin: Phase 6 — Runtime Decoupling / Scale Foundation**
(Redis: throttler store + taqsimlangan lock, BullMQ, `apps/browser-worker`,
cron leader-lock, headful `LoginCapture` ni olib tashlash, SSE progress
Redis pub/sub orqali). Phase 5 unga aynan kerak bo'lgan narsani berdi:
topologiya o'zgarishini **ko'rib turib** qilish imkoni.
