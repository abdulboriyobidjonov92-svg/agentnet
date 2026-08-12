# ADR-022 — Python engine major ko'tarishlari (langgraph/langchain/pillow/fastapi)

**Sana:** 2026-08-12 · **Holat:** PROPOSED (bajarilmagan — Phase 6 bilan birga)
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
- **Xavf bahosi:** topilmalarning aksariyati `pillow` (rasm parsing) va
  `starlette`/`langchain` zanjirida. Engine rasm yuklashni faqat
  camera oqimida ishlatadi (`requirements-camera.txt`, prod'da
  o'rnatilmaydi — SEC-15 §4). Bu xavfni KAMAYTIRADI, lekin YO'Q
  QILMAYDI — shuning uchun ish kechiktirildi, bekor qilinmadi.
- **Phase 6 boshlanganda MAJBURIY:** LangGraph 1.0 migratsiyasi engine
  test to'plami (hozir 50 test) bilan BIRGA keladi — avval migratsiya,
  keyin testlar EMAS. `agent_engine.py` dagi `_content_to_text()` va
  `AgentState` shakli migratsiyaning birinchi tekshiruv nuqtasi.
- Migratsiya bajarilgach, bu ADR `ACCEPTED` ga o'tadi va
  `pip-audit` yashil bo'ladi.
