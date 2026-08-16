---
doc: SPEC_SYSTEM
version: 1.0
status: ACTIVE
created: 2026-08-14
last_verified: 2026-08-14
supersedes: —
superseded_by: —
---

# AGENTNET SPEC SYSTEM

**Barcha keyingi Claude Code promtlari qanday ishlashini belgilovchi qatlam.**

Bu hujjat kod yozish uchun emas. U — **ish tartibi**. Har bir keyingi promt
shu qoidalarga bo'ysunadi.

**Munosabat:** [`../ENGINEERING_CONTRACT.md`](../ENGINEERING_CONTRACT.md) —
**NIMA qurilishi** va **qanday qoidalar bilan** (FROZEN).
Bu hujjat — **ish qanday tashkil qilinishi**. Ziddiyat bo'lsa —
**Contract yutadi**.

---

## 1. TO'RT QAVAT

```
        AGENTNET NORTH STAR
                │
                ▼
    ①  MASTER ROADMAP V3          "NIMA quramiz?"
        docs/strategy/MASTER_ROADMAP_V3.md
        Status: bir marta yoziladi, kamdan-kam o'zgaradi
                │
                ▼
    ②  PHASE BLUEPRINT            "Bu bosqichni QANDAY quramiz?"
        docs/blueprints/P0_BLUEPRINT.md
        Status: JUST-IN-TIME — faqat joriy bosqich uchun
                │
                ▼
    ③  TASK SPEC + IMPLEMENTATION "HOZIR aynan nimani qil?"
        docs/blueprints/P0/P0-2-metering-core.md
        Status: bittadan, ketma-ket
                │
                ▼
    ④  VERIFICATION               "Haqiqatan to'g'rimi?"
        docs/verification/P0-2-verification.md
        Status: YANGI SESSIYADA, toza kontekst bilan
                │
                ▼
         PASS bo'lsagina keyingi taskga o'tiladi
```

**Har qavat keyingisini ochadi:**

| O'tish | Nima aylanadi |
|---|---|
| ① → ② | Roadmap'dagi bosqich elementlari blueprint'ning bo'limlariga aylanadi |
| ② → ③ | Blueprint'dagi har kichik modul bitta task spec'ga aylanadi |
| ③ → ④ | Task spec'dagi Definition of Done verification'ning tekshiruv ro'yxatiga aylanadi |
| ④ → ① | Retro natijasi roadmap'ni yangilaydi (qayta aylanish) |

---

## 2. JUST-IN-TIME QOIDASI

> **Faqat joriy bosqich uchun blueprint yoziladi. Kelajakdagi bosqichlar
> uchun yozilmaydi.**

**Sabab:** V3-P0 dagi metering ma'lumoti narxlash dizaynini o'zgartiradi;
evals natijasi model routing qoidalarini o'zgartiradi. Bugun yozilgan
V3-P4 blueprint o'sha vaqtga borib **eskirgan va yanglishtiradigan**
hujjat bo'ladi.

**Audit dalili:** repo'da 5 ta materially stale hujjat oxirgi 3
incidentning 2 tasiga sabab bo'lgan.

| Bosqich | Blueprint qachon yoziladi |
|---|---|
| V3-P0 | Prompt-1 (docs-only) natijasi ko'rilgandan keyin |
| V3-P1 | V3-P0 tugab, retro yozilgandan keyin |
| V3-P2 | V3-P1 tugab, retro yozilgandan keyin |
| … | shu tartibda |

**Admin Control Plane blueprint'i — V3-P0 metering tugagandan keyin.**
Sabab: `Economy` domeni token usage, model cost, gross margin ko'rsatadi;
bu ma'lumotlar hali mavjud emas. Mavjud bo'lmagan ma'lumot uchun ekran
loyihalash — qayta ishlash.

---

## 3. TASK SPEC SHABLONI — UCH DARAJALI

Har taskka bir xil 23 bo'lim yozish — **hujjat fabrikasi**. Daraja
taskning **qaytarib bo'lmasligi** va **zarar radiusi** bo'yicha tanlanadi.

### TIER A — to'liq spetsifikatsiya

**Qachon:** pul yo'llari · xavfsizlik/policy · data model (migratsiya) ·
qaytarib bo'lmaydigan operatsiyalar · tashqi tomonga ta'sir qiladigan API

**Bo'limlar (20):**

1. Purpose — bitta jumla
2. User problem
3. Business value
4. Scope
5. **Non-goals** — *bu bo'lim majburiy: scope creep'dan yagona himoya*
6. User flows
7. UX/UI talablari
8. Architecture
9. Data model (aniq maydonlar, tiplar, indekslar)
10. API contract (endpoint, request, response, status kodlari)
11. Security
12. Permissions (qaysi rol, qaysi tenant-scope)
13. Failure modes
14. Edge cases
15. Observability (qaysi log, qaysi metrika, qaysi alert)
16. Performance talablari
17. Cost ta'siri
18. Tests (qaysi test, qaysi darajada)
19. Rollback rejasi
20. Definition of Done — mashinada tekshiriladigan

### TIER B — standart

**Qachon:** oddiy feature · UI ekran · ichki refactor

**Bo'limlar (10):** Purpose · Scope · Non-goals · User flow · Architecture ·
Data model (o'zgarsa) · Permissions · Failure modes · Tests ·
Definition of Done

### TIER C — mexanik

**Qachon:** pagination tarqatish · hujjat tuzatish · dependency bump ·
lint fix

**Bo'limlar (4):** Purpose · Scope · Tests · Definition of Done

---

## 4. DEFINITION OF DONE — MASHINADA TEKSHIRILADIGAN BO'LISHI SHART

Bu **eng ko'p buziladigan qoida**. "Acceptance criteria" nasr shaklida
yozilsa, u har doim "bajarildi" deb talqin qilinadi.

**TAQIQLANADI:**

```
- Metering ishlaydi
- Xavfsizlik ta'minlangan
- Testlar yozilgan
```

**TALAB QILINADI** — har qator: **buyruq + kutilgan natija**:

```
- [ ] `cd apps/api && npx jest src/metering` → 0 fail
- [ ] `npx eslint src` → 0 error
- [ ] `cd apps/web && npx tsc --noEmit` → exit 0
- [ ] `psql -c "SELECT count(*) FROM usage_event WHERE input_tokens IS NULL"` → 0
- [ ] Har LLM chaqiruvi UsageEvent yozadi: 10 ta test chaqiruvdan keyin count = 10
- [ ] UsageEvent.idempotencyKey unique constraint mavjud: `\d usage_event` da ko'rinadi
- [ ] Yangi endpoint uchun 1 auth test + 1 scoping test mavjud (Konstitutsiya #14)
```

Agar bir shart mashinada tekshirilmasa — u **`MANUAL:`** prefiksi bilan
yoziladi va verification'da **inson tomonidan** tasdiqlanadi.

---

## 5. O'ZGARISH PROTOKOLI

*Eng muhim qism.* Nima o'zgarishini oldindan bilmaymiz — shuning uchun
o'zgarish mexanizmi hujjatning o'ziga o'rnatiladi.

### 5.1 Har hujjatning header'i majburiy

```markdown
---
doc: P0_BLUEPRINT
version: 1.2
status: ACTIVE          # DRAFT | ACTIVE | SUPERSEDED | ARCHIVED | STALE
created: 2026-08-14
last_verified: 2026-08-21
supersedes: —
superseded_by: —
---
```

**Istisno — ADR fayllari.** `docs/adr/*` repozitoriyning mavjud header
shaklini ishlatadi (`**Sana:** … · **Holat:** … · **Supersedes:** …`),
u ayni ma'noni beradi. ADR'lar YAML front-matter'ga **ko'chirilmaydi** —
ikki xil header shakli bitta ma'no uchun chalkashlik yaratadi.

### 5.2 Status ma'nolari

| Status | Ma'no | Ishlatish mumkinmi |
|---|---|---|
| `DRAFT` | Yozilmoqda, tasdiqlanmagan | **Yo'q** |
| `ACTIVE` | Joriy haqiqat | **Ha** |
| `STALE` | Haqiqatga zid ekani ma'lum, hali tuzatilmagan | ⚠️ Ehtiyot bilan |
| `SUPERSEDED` | Yangisi bor | Yo'q, tarix uchun |
| `ARCHIVED` | Bekor qilingan | Yo'q |

### 5.3 Oltin qoida

> **Haqiqat hujjatga zid chiqsa — hujjat o'sha ish sessiyasida yangilanadi
> yoki `STALE` deb belgilanadi. Jimgina farqlanish TAQIQLANADI.**

Bu Contract'dagi *"kod ADR'ga zid bo'lsa, kod noto'g'ri"* qoidasining
kengaytmasi: **hujjat haqiqatga zid bo'lsa, hujjat noto'g'ri va darhol
tuzatiladi.**

### 5.4 `DECISION_LOG.md` — append-only

[`DECISION_LOG.md`](DECISION_LOG.md) — har o'zgarishga bitta qator.
**Hech qachon o'chirilmaydi, faqat qo'shiladi.**

```markdown
| Sana | Nima o'zgardi | Nega | Ta'sirlangan hujjatlar |
|---|---|---|---|
| 2026-08-21 | Metering'ga cache_read_tokens qo'shildi | Anthropic caching hisobga olinmagan edi, cost hisobi noto'g'ri chiqdi | P0_BLUEPRINT §2, ADR-023 |
| 2026-08-25 | Free tier limiti 50→30 execution | Metering ko'rsatdi: 50 da oylik cost $X, marja manfiy | PRICING_ARCHITECTURE §3 |
```

*(Yuqoridagilar — format namunasi, real yozuv emas. Real jurnal
`DECISION_LOG.md` da.)*

### 5.5 Bosqich retrosi — qayta aylanish

Har bosqich tugagach `docs/blueprints/P<N>_RETRO.md`:

1. Qaysi taxmin noto'g'ri chiqdi
2. Qaysi `[CALIBRATE]` raqam endi `[MEASURED]` bo'ldi
3. Keyingi bosqich blueprint'iga nima o'zgarish kiritilishi kerak
4. Roadmap V3 da nima yangilanishi kerak

> **Retro yozilmasdan keyingi bosqich blueprint'i boshlanmaydi.**

---

## 6. VERIFICATION PROTOKOLI

### 6.1 Yangi sessiya majburiy

**Kod yozgan sessiya o'z kodini tekshirmaydi** — u kamchilikni oqlaydi.
Verification **yangi Claude Code sessiyasida**, kontekstga faqat
quyidagilar berilgan holda:

- Task spec (Definition of Done bilan)
- Kod diff
- ❌ **Kodni yozish jarayoni berilmaydi**

### 6.2 Ikki bosqich

**Bosqich 1 — mexanik** (avval, har doim):

```bash
npx jest                      # 0 fail
npx eslint src                # 0 error
npx tsc --noEmit              # exit 0
node scripts/smoke-test.mjs   # pass
git diff --stat               # kutilgan fayllar doirasidami?
```

**Bosqich 2 — mulohaza** (mexanik o'tgandan keyin): tenant-scoping ·
money-path correctness · race condition · idempotency · API contract ·
permissions · failure mode qamrovi · observability · rollback mavjudligi

### 6.3 Natija formati

Har mezon uchun **aynan bitta**: `PASS` / `FAIL` / `NOT VERIFIED`

> `NOT VERIFIED` — **tekshira olmadim** degani, *"yaxshi ko'rinadi"*
> degani emas. Bu belgi audit hisobotida allaqachon ishlatilgan va halol.

### 6.4 To'xtash qoidasi

**`FAIL` bo'lsa keyingi taskka o'tilmaydi.**

Istisno: ochiq yozilgan sabab bilan **qabul qilingan qarz** — u
[`DECISION_LOG.md`](DECISION_LOG.md) ga yoziladi va roadmap'da vazifa
sifatida paydo bo'ladi.

---

## 7. IMPLEMENTATION PROMT SKELETI

Har task uchun promt **aynan shu shaklda** bo'ladi:

```markdown
## KONTEKST
- docs/strategy/MASTER_ROADMAP_V3.md (o'qi, o'zgartirma)
- docs/blueprints/P0_BLUEPRINT.md (o'qi, o'zgartirma)
- docs/blueprints/P0/P0-2-metering-core.md (bu sening vazifang)

## VAZIFA
Faqat P0-2 ni implement qil.

## TAQIQ
- Boshqa P0 taskka o'tma
- Yangi arxitektura o'ylab topma — blueprint'da bor
- ENGINEERING_CONTRACT'ga zid narsa qilma
- Scope kengaytirma; blueprint §Non-goals ni o'qi
- Blueprint noto'g'ri deb hisoblasang — TO'XTA va menga ayt.
  O'zing tuzatma.

## TUGATISH SHARTI
Task spec §Definition of Done dagi har bandni bajar va
har biri uchun buyruq natijasini ko'rsat.

## HISOBOT
- O'zgartirilgan fayllar
- Definition of Done bo'yicha PASS/FAIL/NOT VERIFIED
- Blueprint bilan farqlar (bo'lsa) — sabab bilan
- Keyingi task uchun ogohlantirish (bo'lsa)
```

> **Eng muhim qator:** *"Blueprint noto'g'ri deb hisoblasang — TO'XTA va
> menga ayt."* Busiz Claude Code jimgina o'zicha tuzatadi va sen buni
> oylar keyin bilib qolasan.

---

## 8. PROMTLAR KETMA-KETLIGI

| № | Promt | Chiqadi | Qachon |
|---|---|---|---|
| 1 | Master Roadmap V3 (docs-only) | strategiya hujjatlari | ✅ Bajarildi (2026-08-14) |
| 1.5 | Spec System repo'ga qo'shish | `docs/process/` | ✅ Bajarildi (2026-08-14) |
| 2 | V3-P0 Blueprint | `P0_BLUEPRINT.md` + task ro'yxati | Prompt-1 natijasi ko'rilgach |
| 3 | P0-1 implementation | kod | P0 Blueprint tasdiqlangach |
| 4 | P0-1 verification | verification hisoboti | **yangi sessiya** |
| 5 | P0-2 implementation | kod | P0-1 `PASS` bo'lsa |
| … | … | … | … |
| N | V3-P0 retro | `P0_RETRO.md` | V3-P0 tugagach |
| N+1 | V3-P1 Blueprint | … | retro yozilgach |

> **V3-P0 ichidagi task ro'yxati hozir muhrlanmaydi** — u P0 Blueprint'da,
> baseline o'lchovlari ko'rilgandan keyin aniqlanadi.

---

## 9. NIMA UCHUN BU TIZIM

**Qaror egaligi aniq ajratiladi:**

| Qaror turi | Kim |
|---|---|
| Strategik (nima quriladi, qaysi tartibda) | **Sen** |
| Arxitektura (qanday quriladi) | Blueprint — **sen tasdiqlaysan** |
| Implementation (kod) | Claude Code |
| Verification (to'g'rimi) | Yangi sessiya + mexanik gate'lar |

Shunda Claude Code **"ijodkor arxitektor" emas** — oldindan belgilangan
tizimni yuqori sifatda bajaruvchi **muhandis** bo'ladi. Bu aynan auditda
maqtalgan intizomni (nol TODO, qaror sabablari yozilgan) kengaytiradi.

---

## 10. XAVF: BU TIZIMNING O'ZI OG'IRLASHIB KETISHI MUMKIN

**Halol ogohlantirish:** qatlamli spetsifikatsiya bitta odam uchun o'zi
to'siqqa aylanishi mumkin.

**Belgilar:**

- Bir hafta o'tdi, blueprint hali yozilmoqda, kod yozilmadi
- TIER C ga tegishli mexanik ish uchun TIER A shablon yozilyapti
- Blueprint kodda hech qachon ishlatilmagan bo'limlar bilan to'lyapti

**Chora:** blueprint bosqich uchun **maksimum 1–2 kun**. Undan oshsa —
juda chuqur ketyapsan, TIER pasaytir. **Hujjat kodni tezlashtirishi kerak,
sekinlashtirishi emas.**

**O'lchov:**

```
hujjat yozishga ketgan vaqt / kod yozishga ketgan vaqt  <  1/3
```

Oshsa — tizim o'z maqsadiga zid ishlayapti.

---

## 11. Hujjat xaritasi

| Hujjat | Qavat | Holat |
|---|---|---|
| [`../ENGINEERING_CONTRACT.md`](../ENGINEERING_CONTRACT.md) | ustki qonun | FROZEN |
| [`../ENGINEERING_CONTRACT_ADDENDUM_V3.md`](../ENGINEERING_CONTRACT_ADDENDUM_V3.md) | ustki qonun | ACTIVE |
| [`../strategy/MASTER_ROADMAP_V3.md`](../strategy/MASTER_ROADMAP_V3.md) | ① | ACTIVE |
| `../blueprints/P<N>_BLUEPRINT.md` | ② | hali yo'q — JIT (§2) |
| `../blueprints/P<N>/<task>.md` | ③ | hali yo'q |
| `../verification/<task>-verification.md` | ④ | hali yo'q |
| `../blueprints/P<N>_RETRO.md` | ④→① | hali yo'q |
| [`DECISION_LOG.md`](DECISION_LOG.md) | kesib o'tuvchi | ACTIVE |
| [`SPEC_SYSTEM.md`](SPEC_SYSTEM.md) | kesib o'tuvchi | ACTIVE |
