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

| Endpoint turi | Guard |
|---|---|
| Oddiy foydalanuvchi endpointi | `@UseGuards(ClerkGuard)` |
| Engine LLM chaqiradigan (pulsiz, kvota kerak) | `@UseGuards(ClerkGuard, LlmQuotaGuard)` |
| Servis-ichi (webhook, engine→API, BFF→API) | `@UseGuards(InternalTokenGuard)` |
| BFF orqali keladigan, bitta IP'dan (charge-message, consume-chat) | `@SkipThrottle()` |

**Muhim:** `ClerkGuard` `AuthModule`dan eksport qilinmaydi — har modul uni o'z
`providers` massivida QAYTA e'lon qilishi kerak (`imports: [AuthModule]` YETARLI EMAS).
Bu — konvensiya, xato emas; 18/18 mavjud modul shu naqshni ishlatadi.

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
