# ADR-022 — Python engine major ko'tarishlari (langgraph/langchain/pillow/fastapi)

**Sana:** 2026-08-12 · **Holat:** **ACCEPTED** (qisman bajarildi — `starlette`
va `pillow` YOPILDI; faqat langgraph/langchain zanjiri deferred qoldi.
Yakuniy holat uchun "Accepted Risk / Deferred Upgrade" bo'limiga qarang —
u yuqoridagi 1-5 bo'limlardagi dastlabki ro'yxatni TUZATADI.)
**Bog'liq:** SEC-15 (`docs/status/sec15-audit.md`), `docs/status/ci-red-2026-08-12.md` §3
**Ta'sir qiladi:** `apps/agent-engine` (yadro ijro oqimi)

## Problem

`pip-audit` CI ishi (BLOKLOVCHI) **45 ta advisory** topmoqda — 8 ta paketda.
Ish `--audit-level` ekvivalentiga EGA EMAS: `pip-audit` topilmalarni
jiddiylik bo'yicha filtrlay olmaydi, ya'ni **har qanday** topilma CI'ni
qizartiradi (`ci.yml` 60-64, ataylab shunday).

Bu topilmalar 2026-08-12 gacha **ko'rinmagan** edi — chunki
`pip install -r requirements.txt` `pydantic` konflikti sababli
`ResolutionImpossible` bilan yiqilardi va skaner daraxtni umuman hal qila
olmasdi. Konflikt tuzatilgach (`ab05358`), haqiqiy manzara ochildi.

Zaifliklarni yopish uchun kerak bo'lgan versiyalar:

| Paket | Hozir | Kerak | Sakrash |
|---|---|---|---|
| `langgraph` | 0.2.62 | 1.0.10 | **MAJOR** (0.x → 1.x) |
| `langchain-core` | 0.3.86 | 1.2.11 | **MAJOR** |
| `langchain-anthropic` | 0.3.3 | 1.4.6 | **MAJOR** |
| `langgraph-checkpoint` | 2.1.2 | 3.0.0 / 4.1.1 | **MAJOR** |
| `pillow` | 11.1.0 | 12.1.1+ | **MAJOR** |
| `starlette` (fastapi orqali) | 0.41.3 | 0.47.2 … 1.3.1 | **fastapi MAJOR** |
| `langgraph-sdk` | 0.1.74 | 0.3.15 | minor (0.x) |
| `python-dotenv` | 1.0.1 | 1.2.2 | minor |

`langgraph` va `langchain-anthropic` — engine YADROSI: `StateGraph`,
`ChatAnthropic`, `AgentState`, tugun/qirra API'lari. LangGraph 1.0 bu
yuzalarni qayta shakllantirgan.

## Decision

**Major ko'tarishlar HOZIR qilinmaydi. `pip-audit` ATAYLAB qizil qoldiriladi
va bu holat OCHIQ hujjatlashtiriladi.** Ko'tarish **Phase 6 (Runtime
Decoupling)** bilan BIRGA, alohida ish sifatida rejalashtiriladi.

Shu qaror bilan birga MAJBURIY bo'lgan narsa: qizillik **yashirilmaydi**.
Hech qanday `--ignore-vuln`, `|| true`, `continue-on-error` yoki allowlist
QO'SHILMAYDI. CI qizil turadi va sabab shu ADR'ga ishora qiladi.

**Nega Phase 6 bilan birga:** Phase 6 shundoq ham engine ijro topologiyasini
o'zgartiradi (BullMQ, `apps/browser-worker`, SSE progress Redis pub/sub).
LangGraph 1.0 migratsiyasi aynan o'sha yuzalarga tegadi — ikkalasini birga
qilish bitta regressiya-tekshiruv sikli beradi, ketma-ket qilish esa
ikkitasini talab qiladi va oraliqda ikki marta buzilish xavfi bor.

## Alternatives

1. **Majorlarni darhol ko'tarish.**
2. **`--ignore-vuln` bilan advisory'larni vaqtincha o'chirish.**
3. **`pip-audit` ni bloklovchi bo'lmagan holga o'tkazish** (`|| true` yoki
   `continue-on-error`).
4. **Faqat minor'larni olish** (`python-dotenv`, `langgraph-sdk`).
5. **Dependabot pip PR'ini merge qilish.**

## Why rejected

1. **Darhol ko'tarish — RAD ETILDI (hozircha).** LangGraph 0.2 → 1.0
   engine yadrosini qayta yozishni talab qiladi. Buni Phase 5 tugagan,
   Phase 6 boshlanmagan oraliqda, boshqa hech qanday himoya to'ri
   bo'lmagan holda qilish — Contract §3 dagi "fazalar qayta
   tartiblanmaydi" qoidasining ruhiga zid. Bu qaror ATAYLAB
   kechiktirildi, RAD ETILMADI.

2. **`--ignore-vuln` — RAD ETILDI.** SEC-15 §12 aniq: "Ochiq istisno
   YO'Q. Hech qanday advisory `--ignore-vuln` bilan o'chirilmagan".
   45 ta advisory'ni jimgina o'chirish gate'ni ma'nosiz qilardi va
   SEC-15 oldini olmoqchi bo'lgan "e'tiborsizlik madaniyati"ni aynan
   yaratardi.

3. **Gate'ni bo'shashtirish — RAD ETILDI.** `ci.yml` 60-64 bu qat'iylikni
   ATAYLAB tanlagan. Zaiflik bor bo'lsa CI qizil bo'lishi KERAK; qizil
   CI — signal, uni o'chirish muammoni yo'q qilmaydi.

4. **Faqat minor'lar — QISMAN, YETARLI EMAS.** `python-dotenv` va
   `langgraph-sdk` xavfsiz ko'tariladi, lekin gate BINAR: 45 → 43 ham
   exit 1. Ya'ni bu ishni bajaradi, natijani BERMAYDI. Shu sababli
   alohida qiymat sifatida ko'rilmadi (major ishining ichida ketadi).

5. **Dependabot pip PR — MERGE QILINMADI.** Lokal o'lchandi: PR
   45 → **34** topilmaga tushiradi, lekin `pip-audit` HAMON exit 1
   (`langgraph` 0.6.11 < 1.0.10, `pillow` 11.3.0 < 12.1.1,
   `langchain-anthropic` 0.3.22 < 1.4.6). Ya'ni PR CI'ni yashil
   QILMAYDI, lekin `langgraph` ni 0.2.62 → 0.6.11 ga sakratib
   buzuvchi o'zgarish xavfini KIRITADI. Foyda/xavf nisbati salbiy —
   uni major ishining ichida, bitta rejalashtirilgan migratsiya
   sifatida qilish to'g'ri.

## Long-term impact

- **`pip-audit` Phase 6 gacha QIZIL turadi.** Bu — ma'lum va qabul
  qilingan holat, sir emas. Har kim CI'ga qarasa sababni
  `ci-red-2026-08-12.md` §3 va shu ADR'dan topadi.
- ~~**Xavf bahosi:** topilmalarning aksariyati `pillow` (rasm parsing) va
  `starlette`/`langchain` zanjirida.~~ **ESKIRGAN** — `pillow` (24 ta) va
  `starlette` (9 ta) o'sha kuni YOPILDI, ya'ni endi topilmalarning
  HAMMASI faqat `langchain`/`langgraph` zanjirida. Yangilangan xavf
  bahosi: "Accepted Risk / Deferred Upgrade" §B.
- **Phase 6 boshlanganda MAJBURIY:** LangGraph 1.0 migratsiyasi engine
  test to'plami (hozir 50 test) bilan BIRGA keladi — avval migratsiya,
  keyin testlar EMAS. `agent_engine.py` dagi `_content_to_text()` va
  `AgentState` shakli migratsiyaning birinchi tekshiruv nuqtasi.
- Migratsiya bajarilgach, bu ADR `ACCEPTED` ga o'tadi va
  `pip-audit` yashil bo'ladi.

---

## Accepted Risk / Deferred Upgrade (2026-08-12, YANGILANDI)

Bu bo'lim ADR yozilgandan keyingi ikkita o'zgarishni rasmiylashtiradi:
`starlette` va `pillow` endi **deferred EMAS** (ikkalasi ham yopildi), va
qolgan `langgraph`/`langchain` zanjiri uchun **rasmiy qabul qilingan xavf**
e'lon qilinadi.

### A. ADR'ning dastlabki ro'yxatiga TUZATISH

ADR dastlab beshta paketni bitta ro'yxatga qo'ygan edi
(`langgraph`, `langchain-anthropic`, `pillow`, `fastapi`, `starlette`) va
shu bilan **hammasi bir xil sababdan bloklangan** degan taassurot
qoldirgan edi. Bu NOTO'G'RI edi:

| Paket | Haqiqiy holat | Natija |
|---|---|---|
| `starlette` | `fastapi <0.42.0` bilan bloklangan edi | ✅ **YOPILDI** — `fastapi` 0.141.1 (`3dfcdf3`), starlette 1.6.0, 9 ta advisory ketdi |
| `pillow` | **HECH BIR cheklov bilan bloklanmagan** | ✅ **YOPILDI** — 12.3.0 (`08ed00e`), 24 ta advisory ketdi |
| `langgraph`, `langchain-anthropic`, `langchain-core`, `langgraph-checkpoint`, `langgraph-sdk` | haqiqatan bloklangan (o'zaro cheklovlar) | ⚠️ **DEFERRED** — quyida |

`pillow` uchun asos: uni faqat `google-genai` va faqat **ixtiyoriy
ekstra** orqali so'raydi (`pillow; extra == "local-tokenizer"`) — biz u
ekstrani o'rnatmaymiz. Engine kodi PIL'ni hech qayerda import qilmaydi.
Ya'ni 11 -> 12 major'ining ta'sir yuzasi NOL edi va uni kechiktirish
uchun texnik sabab yo'q edi.

### B. Qabul qilingan xavf — `langgraph` / `langchain` zanjiri

**Qamrov: 10 ta alohida advisory, 5 ta paketda** (`pip-audit`, 2026-08-12):

| Paket | Versiya | Advisory | CVE | Tuzatish |
|---|---|---|---|---|
| `langgraph` | 0.2.62 | PYSEC-2026-83 | CVE-2026-28277 | 1.0.10 |
| `langgraph` | 0.2.62 | PYSEC-2026-2194 | CVE-2026-48776 | 0.3.15 |
| `langchain-anthropic` | 0.3.3 | PYSEC-2026-2556 | CVE-2026-55443 | 1.4.6 |
| `langchain-core` | 0.3.86 | PYSEC-2026-2193 | CVE-2026-34070 | 1.2.22 |
| `langchain-core` | 0.3.86 | PYSEC-2026-2562 | CVE-2026-26013 | 1.2.11 |
| `langgraph-checkpoint` | 2.1.2 | PYSEC-2026-1527 | CVE-2025-64439 | 3.0.0 |
| `langgraph-checkpoint` | 2.1.2 | PYSEC-2026-2573 | CVE-2026-48775 | 4.1.1 |
| `langgraph-checkpoint` | 2.1.2 | PYSEC-2026-2574 | CVE-2026-27794 | 4.0.0 |
| `langgraph-sdk` | 0.1.74 | PYSEC-2026-2194 | CVE-2026-48776 | 0.3.15 |
| `langgraph-sdk` | 0.1.74 | PYSEC-2026-2575 | CVE-2026-48776 | 0.3.15 |

**QAROR:**

> Bu paketlarni ko'tarish **major versiya sakrashini** talab qiladi va u
> **AI engine'ning yadro ish-vaqti xulqini o'zgartiradi** (`StateGraph`
> tugun/qirra API'lari, `ChatAnthropic` konstruktori, `AgentState`
> shakli, checkpoint serializatsiyasi). Shu sababli u alohida
> **"AI Engine Dependency Upgrade"** vazifasiga — to'liq baholash
> (evaluation harness) sinovlari bilan — kechiktiriladi. Shu vaqtgacha
> yuqoridagi aniq CVE'lar bizning **izolyatsiyalangan, ommaviy
> internetga chiqarilmagan** AI-ijro muhitimizda **past xavf** sifatida
> QABUL QILINADI.

**Izolyatsiya da'vosi — TEKSHIRILGAN, taxmin emas:** engine
`render.yaml` da `type: pserv` (Render **Private Service**) —
SEC-10 / ADR-004 / Konstitutsiya qoidasi #5 ("Engine hech qachon ommaviy
internetga chiqarilmaydi"). Ya'ni bu paketlarga internetdan
TO'G'RIDAN-TO'G'RI so'rov yuborib bo'lmaydi; yagona yo'l — autentifikatsiya
qilingan API orqali.

**HALOL CHEKLOV (xavf NOLGA teng emas):** izolyatsiya hujum yuzasini
kamaytiradi, lekin YO'Q QILMAYDI — engine baribir foydalanuvchi
matnini (prompt) qayta ishlaydi, ya'ni ishonchsiz KIRISH ma'lumoti unga
API orqali yetib boradi. Shuning uchun bu **kechiktirish**, bekor qilish
EMAS, va muddati bor (quyida).

### C. Bu istisnoning CHEGARALARI (majburiy)

1. **`--ignore-vuln` ISHLATILMAYDI.** `pip-audit` bu CVE'larni CI'da
   ko'rsatishda DAVOM etadi va ish QIZIL turadi. Bu — "e'tiborsiz
   qoldirilgan xato" emas, **hujjatlashtirilgan siyosat istisnosi**:
   farqi shundaki, u KO'RINIB turadi va har CI ishida qayta eslatiladi.
2. `ci.yml` ga `|| true` yoki `continue-on-error` QO'SHILMAYDI.
3. Bu istisno FAQAT yuqoridagi 10 ta ID'ga tegishli. Zanjirda YANGI
   advisory chiqsa — u avtomat ravishda bu istisnoga KIRMAYDI va qayta
   baholanadi.
4. **Muddat:** Phase 6 (Runtime Decoupling) boshlanishida qayta ko'riladi.
   Agar zanjirda `CRITICAL` darajali yoki masofadan kod ijro etish (RCE)
   advisory'si paydo bo'lsa — istisno DARHOL bekor bo'ladi va migratsiya
   navbatdan tashqari boshlanadi.

### D. Holat

`pip-audit` natijasi: **45 -> 11** (2026-08-12 kuni ichida).

```
45  (boshlang'ich, resolver tuzatilgandan keyin ko'ringan)
-9  starlette      (fastapi 0.141.1)
-1  python-dotenv  (1.2.2)
-24 pillow         (12.3.0)
= 11  langgraph/langchain zanjiri  <- SHU ISTISNO
```
