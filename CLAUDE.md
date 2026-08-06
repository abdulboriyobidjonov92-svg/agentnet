# CLAUDE.md — AgentNet ijro-qoidalari

Bu fayl kod bilan ishlaydigan har bir agent/muhandis uchun **ijro** qoidalarini beradi.
**Arxitektura qarorlari** uchun yagona haqiqat manbai: [`docs/ENGINEERING_CONTRACT.md`](docs/ENGINEERING_CONTRACT.md).
Tarixiy audit (o'zgarmaydi): [`docs/ARCHITECTURAL_AUDIT.md`](docs/ARCHITECTURAL_AUDIT.md).

Agar bu fayl va kod ziddiyatga kelsa — **Engineering Contract yutadi**. Agar bu fayl va
Contract ziddiyatga kelsa — **Contract yutadi** (bu fayl faqat uni ijro etadi).

## Branch

Asosiy ish branch — **`master`**. CI `master` va `main`da ishga tushadi (`.github/workflows/ci.yml`).
Push/PR qilishdan oldin CI yashil bo'lishi shart — istisno yo'q.

## Test/build buyruqlari (commit'dan oldin, tegishli qismda)

```bash
# apps/api
cd apps/api && npx tsc --noEmit -p tsconfig.json   # typecheck
cd apps/api && npx eslint src                       # lint
cd apps/api && npx jest                              # unit testlar
cd apps/api && npx prisma validate                   # schema o'zgargan bo'lsa

# apps/web
cd apps/web && npx tsc --noEmit -p tsconfig.json
cd apps/web && npx eslint src

# apps/agent-engine (venv: .venv/Scripts/python.exe Windows'da)
cd apps/agent-engine && ./.venv/Scripts/python.exe -m ruff check .
cd apps/agent-engine && ./.venv/Scripts/python.exe -m pytest -q
```

CI shu tekshiruvlarning barchasini bajaradi (`.github/workflows/ci.yml`, 3 job: web/api/agent-engine + turbo-build).

## Prisma — faqat service ichida

`PrismaService` faqat `*.service.ts` fayllarida chaqiriladi. Controller, guard, DTO, BFF
route'da to'g'ridan-to'g'ri Prisma chaqiruvi taqiqlanadi (Engineering Contract Rule #22).

## Guard matritsasi (yangi endpoint qo'shganda)

SEC-05 (Option B)'dan beri `AuthGuard` (ilgari `ClerkGuard` — SEC-09'da qayta
nomlandi, hech qachon Clerk ishlatmagan) va `RolesGuard` **global** `APP_GUARD`
sifatida ro'yxatdan o'tgan (`app.module.ts`) — hech bir controller/modulda
qayta e'lon qilinmaydi. Ochiq (autentifikatsiyasiz) endpoint `@Public()` bilan
ANIQ belgilanadi (aks holda default — kamida MEMBER talab qilinadi).

| Endpoint turi | Qo'shimcha guard/dekorator |
|---|---|
| Oddiy foydalanuvchi endpointi | Yo'q — global `AuthGuard`+`RolesGuard` yetarli |
| Admin (`@Roles(...)` talab qiladi) | `@Roles(UserRole.OWNER, ...)` |
| BFF→API, foydalanuvchi kontekstli (refund, chat stream) | `@UseGuards(InternalTokenGuard)` — `@Public()`SIZ (aks holda `@CurrentUser()` bo'sh bo'ladi) |
| Engine LLM chaqiradigan (pulsiz, kvota kerak) | `@UseGuards(LlmQuotaGuard)` |
| Servis-ichi (webhook, engine→API, BFF→API) | `@Public()` + `@UseGuards(InternalTokenGuard)` |
| Chinakam ochiq (webhook, companion o'z-tokeni, login-oldi) | `@Public()` |
| BFF orqali keladigan, bitta IP'dan (charge-message, consume-chat) | `@SkipThrottle()` |

**SEC-11 (Konstitutsiya #10) — BAJARILGAN va MUZLATILGAN:** `@Roles(...)` bilan
himoyalangan yo'lda foydalanuvchi roli `OWNER`/`ADMIN` bo'lsa, `RolesGuard`
qo'shimcha ravishda `twoFactorEnabled`ni talab qiladi (aks holda 403
`reason: 'two_factor_required'`). Bu imtiyozni 2FA ortiga oladi, lekin hech kimni
QULFLAMAYDI — dekoratorsiz yo'llar (jumladan `/auth/2fa/*`) 2FA'siz ham ochiq,
ya'ni admin o'zi 2FA'ni yoqib imtiyozini qaytaradi. Yangi admin endpoint
qo'shganda bu avtomatik qo'llanadi.

### ⚠️ SEC-11'ning qolgan qismi — ATAYLAB KECHIKTIRILGAN (Phase 4 gacha)

Engineering Contract §6.5'dagi **xavfli-amal oqimi** — sabab matni (min 20 belgi)
→ TOTP qayta-autentifikatsiya → yozib tasdiqlash (`DELETE user_abc123`) → IKKITA
audit yozuvi (`intent` + `result`) → 24 soatlik bekor oynasi (o'chirish uchun) →
OWNER Telegram signali, + 10/soat throttle — **hali yozilmagan**.

**Nega:** Contract SEC-11 uchun `Deps: SEC-05, P4` deydi. Bugun butun `@Roles`
yuzasi — ikkita `feedback` endpointi (`list`, `setStatus`), ularning ikkalasi
ham §6.5 ma'nosida xavfli EMAS. Oqimni hozir yozish — nol chaqiruv-nuqtali
guard/service/dekorator/DTO demak, ya'ni **Qoida #38 buzilishi** ("o'lik kod
darhol o'chiriladi — 'keyin kerak bo'ladi' taqiqlanadi"). Xavfli endpointlarni
hozir yozish esa **§3 buzilishi** ("fazalar qayta tartiblanmaydi": P4 P3'dan
oldin kelmaydi).

**MAJBURIY SHART — P4'ni boshlaydigan kishi uchun:** §6.5 ro'yxatidagi BIRINCHI
xavfli endpoint (rol tayinlash · balansdan yechish · qo'lda kredit >500k ·
foydalanuvchini o'chirish · sessiyalarni ommaviy bekor qilish · to'lovni qo'lda
yopish · global limit o'zgartirish · impersonation-write) **oqim bilan BIRGA**
keladi — endpoint avval, kontrol keyin EMAS. Bu Contract §3'dagi Phase 2
mantig'ining aynan o'zi: *"Avval ekran qurilsa, avtorizatsiya keyin 'yamoq'
bo'lib qo'shiladi — bu sinf xatosi."*

## Tenant-scoping (SEC-06)

Har bir `prisma.<model>.findMany`/`.findFirst` (yoki `tx.<model>.findMany`/`.findFirst`
tranzaksiya ichida) `where`sida `userId`/`ownerId`/`creatorId`/`actorId` — yoki shu
suffikslar bilan tugaydigan boshqa nom (`originalCreatorId`, `previousOwnerId`...) —
bo'lishi SHART. Bo'lmasa, ESLint CI'da bloklaydi (`local/require-tenant-scope`,
`apps/api/eslint-rules/require-tenant-scope.js`).

Agar so'rov ATAYLAB tenant-scope qilinmagan bo'lsa, aynan bitta sababni ko'rsatuvchi
izoh qo'yiladi (bo'sh `@admin-scope`ni hammasiga yopishtirish TAQIQLANADI — bu
istisno mexanizmining o'zini ma'nosiz qiladi):

| Izoh | Qachon |
|---|---|
| `@admin-scope` | `@Roles(...)` bilan himoyalangan admin yo'lidan chaqiriladigan chinakam cross-tenant o'qish |
| `@system-scope` | Cron/scheduled job yoki global ichki holat (foydalanuvchi so'roviga bog'liq emas) |
| `@public-scope` | Ataylab ommaviy ma'lumot (`@Public()` endpoint qatoridagi katalog/ro'yxat) |
| `@preauth-scope` | Foydalanuvchi hali aniqlanmagan so'rov (OTP, companion-token qidiruvi) |
| `@upstream-scope` | Egalik shu metod ichida OLDINROQ (`findUnique` + `if (x.userId !== user.id) throw`) allaqachon tekshirilgan |
| `@org-scope` | Individual foydalanuvchi emas, tashkilot (`orgId`) darajasida scope |

Cross-tenant o'qish uchun yagona rasmiy nuqta — `apps/api/src/admin/admin-query.service.ts`
(`AdminQueryService`). U hech narsani avtomatik scope QILMAYDI — ataylab shunday
(`ScopedQuery`-uslubidagi avtomatik-scoping helper ATAYLAB qurilmagan).

## i18n — uchala til birga

Har yangi UI matni **bir vaqtda** `apps/web/src/lib/i18n/locales/{en,ru,uz}.ts`ga qo'shiladi.
Kalit to'plami uchtasida ham AYNAN bir xil bo'lishi shart (hozircha qo'lda tekshiriladi;
CI'ga avtomatik kalit-tenglik testi qo'shish — Engineering Contract §9, Medium ustuvorlik).

## Migratsiya nomlash

`YYYYMMDDHHMMSS_snake_case_qisqa_tavsif` (Prisma standart formati). Har migratsiya
`prisma migrate dev` bilan generatsiya qilinadi — qo'lda SQL yozilmaydi. `--accept-data-loss`
hech qachon ishlatilmaydi (Rule #27).

## Pul yo'llariga tegilganda

- LLM chaqiruvidan OLDIN pul yechiladi (prepaid).
- Har o'zgarish atomik: `updateMany({where: {..., balance: {gte: amount}}})` yoki
  `$transaction` + `pg_advisory_xact_lock`.
- Har o'zgarish `CreditLedger`/`CreatorLedger`ga yoziladi.
- Refund har doim `idempotencyKey` bilan.
- To'liq ro'yxat: Engineering Contract §11, "Pul" bo'limi (15-21-qoidalar).

## Feature freeze (Phase 0-4 davomida)

Engineering Contract §2 (A39): yangi vertikal/dashboard sahifa Phase 4 (Admin Panel)
tugamaguncha qo'shilmaydi. Mavjud modullarni tuzatish/mustahkamlash — bemalol.

## Commit intizomi

- Kichik, bitta-mantiqiy-o'zgarish commitlar (Constitution — Non-negotiable Rule, umumiy qoida).
- Har commit'dan oldin: shu commit tegadigan qismning typecheck+lint+test'i o'tishi shart.
- `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` — AI-generatsiya qilingan
  commitlarda.

## ADR

Yangi arxitektura qarori — `docs/adr/NNNN-<mavzu>.md` (Engineering Contract §5 formatida:
Problem / Decision / Alternatives / Why rejected / Long-term impact). Eski ADR'ni
o'zgartirish emas — yangisi yoziladi, eskisi `SUPERSEDED` deb belgilanadi.
