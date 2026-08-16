---
doc: BUILD_VS_BUY
version: 1.0
status: ACTIVE
created: 2026-08-14
last_verified: 2026-08-14
supersedes: —
superseded_by: —
---

# BUILD vs BUY — qaror qoidasi va jadvali

**Sana:** 2026-08-14 · **Versiya:** 1.0 · **Holat:** ACTIVE
**Ustun hujjat:** [`../ENGINEERING_CONTRACT.md`](../ENGINEERING_CONTRACT.md) (FROZEN)
**Bog'liq:** [`MASTER_ROADMAP_V3.md`](MASTER_ROADMAP_V3.md) · ADR-025 · ADR-026 · ADR-027

---

## 0. QOIDA — har yangi qaror shu darvozadan o'tadi

> **Keng va umumiy narsani SOTIB OL. Chuqur va mahalliy narsani QUR.**

Har yangi tashqi bog'liqlik yoki yangi ichki komponent qaroridan **oldin**
quyidagi to'rt savolga yozma javob beriladi:

1. **Bu moatmi?** Agar ha — qur. Moat sotib olinmaydi.
2. **Bu keng va umumiymi?** (1000+ ilova, standart protokol) — sotib ol.
3. **Ma'lumot qayerga boradi?** Agar foydalanuvchi/biznes ma'lumoti uchinchi
   tomonga chiqsa — data residency savoli ochiladi (§9 MASTER_ROADMAP_V3).
4. **Vendor yo'q bo'lsa nima bo'ladi?** Javob "mahsulot o'ladi" bo'lsa —
   almashtiriladigan qilib arxitektura quriladi yoki qaror rad etiladi.

To'rt savolga javobsiz qabul qilingan qaror — **Konstitutsiya #40 buzilishi**
(yangi tashqi bog'liqlik ADR bilan asoslanadi).

---

## 1. Qaror jadvali

| Toifa | Qaror | Sabab | Tavsiya etilgan vendor(lar) | Lock-in xavfi | Lock-in'dan qochish usuli | Qachon qayta ko'riladi |
|---|---|---|---|---|---|---|
| **Keng ulanish (1000+ ilova)** | ✅ **SOTIB OL** | 17 konnektor bilan cheklanmaslik to'g'ri, lekin 1000 tasini o'zi yozish **solo founder uchun ijro halokati**. Composio 1000+ toolkit / 20 000+ tool, Pipedream 2 500–3 000+ ilova `[FROM-RESEARCH]` | **Composio** (birinchi), **Merge Agent Handler** (muqobil). ⚠️ Pipedream'ni **Workday sotib oldi** — mustaqil agent-builder yo'nalishi noaniq `[FROM-RESEARCH]`, shuning uchun ustuvor emas | **Yuqori** — agregator yo'qolsa yuzlab tool yo'qoladi | Ichki `ConnectorProvider` interfeysi (mavjud `connectors.registry.ts` naqshi kengaytiriladi); agregator **adapter ortida** turadi; mahalliy 17 konnektor **hech qachon** agregator orqali ketmaydi | V3-P2 oxirida (foydalanish hajmi bilan) |
| **Mahalliy chuqur ulanish** (Payme, Click, Uzum, Didox, soliq.uz, my.gov.uz, Eskiz, PlayMobile) | ✅ **QUR** | **Proprietary moat.** Global agregatorda bu integratsiyalar yo'q va bo'lmaydi (bozor hajmi ularning e'tibor chegarasidan past). Merchant shartnomalari va portal xulqi — ko'chirilmaydigan aktiv | — (o'zimiz) | Yo'q | — | Hech qachon (bu — moat yadrosi) |
| **Brauzer infratuzilmasi** | ✅ **SOTIB OL** | Chromium hozir **API jarayoni ichida** `[MEASURED]` (`playwright` `apps/api/package.json`) — **Critical xavf**: API OOM = butun platforma. Worker'ga ajratish (Contract A21) — **yarim yechim**; managed infra — to'liq yechim | **Browserbase**, **Steel.dev** | **O'rta** — sessiya oqimi vendor API'siga bog'lanadi | Ichki `BrowserRunner` interfeysi; lokal Playwright yo'li **fallback sifatida saqlanadi** (dev + vendor uzilishi) | ⚠️ **Contract ADR-010 bu variantni RAD ETGAN** — qarang §2 |
| **Model routing infra** | ✅ **SOTIB OL** | Ko'p provayder, narx o'zgaruvchan, routing infrastrukturasini o'zi qurish — nol differensiatsiya | **OpenRouter** (mavjud: `llm_utils.py` chokepoint `[MEASURED]`, `render.yaml` da `OPENROUTER_API_KEY`) | **Past** — OpenAI-mos API | Chokepoint allaqachon bitta faylda; to'g'ridan-to'g'ri Anthropic yo'li saqlanadi | Har chorak (narx) |
| **Free tier model quvvati** (2026-08-16 dan) | ✅ **SOTIB OL** (bepul qatlam) | Nol byudjet: har bepul obunachiga pullik chaqiruvni moliyalashtirib bo'lmaydi. OpenRouter `:free` katalogi — yagona real variant | **OpenRouter `:free`** + **ko'p-model rotatsiya** (`openrouter_client.py`, 5 model) va **hisob darajasidagi limit boshqaruvi** (buferli kunlik budjet `[MEASURED]`) | **O'rta** — limit HISOB darajasida (20/daq; 50 yoki 1000/kun `[FROM-RESEARCH]`), model katalogi tez-tez o'zgaradi | Rotatsiya ro'yxati `OPENROUTER_FREE_MODELS` env orqali deploy'siz almashadi; budjet tugasa pullik tier **hech qanday ta'sir ko'rmaydi** (zanjirlar butunlay ajratilgan) | Oyiga bir marta (katalog + tool-calling qo'llab-quvvatlashi) |
| **Routing QOIDALARI** (qaysi vazifa qaysi modelga) | ✅ **QUR** | Bu — **IP**. Qaysi vazifa arzon modelga tushishi mumkinligini faqat bizning eval ma'lumotimiz biladi | — | Yo'q | — | — |
| **Foydalanuvchi/biznes xotirasi** | ✅ **QUR** (self-hosted pgvector) | **"Sotib ol" bu yerda XATO.** Mem0/Zep — AQSh SaaS'lari; foydalanuvchi/biznes xotirasini ularga jo'natish **O'zbekiston data-residency muammosini uchinchi tomon orqali qayta tiklaydi**. Naqshini o'rgan, ma'lumotni o'zingda saqla | — (Postgres + pgvector; Contract A10 ga mos — ikkinchi DB emas) | Yo'q | — | Faqat data residency talablari o'zgarsa |
| **Evals / reliability scoring** | ✅ **QUR** | **Moat** (§2 M5). Global eval to'plamlari o'zbek soliq hisobotini o'lchamaydi | — | Yo'q | — | — |
| **Policy engine / approval** | ✅ **QUR** | **Moat** (§2 M3 — human approval data). Tashqi policy engine (OPA) Contract ADR-002 da allaqachon rad etilgan | — | Yo'q | — | — |
| Xato kuzatuvi / APM | ✅ SOTIB OL (bajarilgan) | Contract A36/ADR-015 | **Sentry** (ulangan `[FROM-AUDIT]`) | Past | DSN bo'sh qolsa kod xulqi o'zgarmaydi | — |
| Fayl saqlash | ✅ SOTIB OL | Contract A25/ADR-007 | **Cloudflare R2** | Past (S3-mos) | S3 API — ko'chirish arzon | — |
| Hosting | ✅ SOTIB OL | Contract A38/ADR-019, ADR-021 | **Render** (backend) + **Vercel** (frontend) | O'rta | Docker image'lar portativ; frontend deploy-portativ (ADR-021) | 1M foydalanuvchida |
| To'lov protokollari | ✅ QUR | Contract A26/ADR-003 — real protokol implementatsiyasi | — | — | — | Global ekspansiyada |

---

## 2. ⚠️ Contract bilan qarama-qarshilik — brauzer infratuzilmasi

**Contract ADR-010 aynan shunday deydi:**

> *"Rad etildi: (a) Browserless/Browserbase — foydalanuvchi sessiya
> cookie'lari uchinchi tomon infratuzilmasiga chiqadi — bizning eng maxfiy
> aktivimiz; **qabul qilinmaydi**."*

**V3 pozitsiyasi:** managed brauzer infratuzilmasi qayta ko'rib chiqilishi
kerak, chunki (a) Chromium hamon API jarayonida `[MEASURED]`, (b)
`apps/browser-worker` hali qurilmagan `[MEASURED]`, (c) uni qurish Contract
bahosi bo'yicha **8 ED**.

**QAROR: Contract USTUN.** ADR-010 kuchda qoladi. Managed brauzer
**ADR-026** da alohida qaror sifatida ko'riladi va u **faqat**
quyidagi shart bilan qabul qilinishi mumkin:

> Sessiya cookie'lari (`storageState`) **hech qachon** vendor infratuzilmasiga
> yuborilmaydi — vendor faqat **anonim (sessiyasiz)** brauzer ishlari uchun
> ishlatiladi; sessiyali ishlar o'z worker'imizda qoladi.

Agar bu shart texnik jihatdan ta'minlanmasa — **sotib olish rad etiladi**
va Contract A21 yo'li (o'z worker'i) bajariladi. Batafsil: **ADR-026**.

---

## 3. Nima UCHUN 17 konnektor yetarli emas, lekin 1000 tasini yozish ham xato

| Yondashuv | Natija |
|---|---|
| Faqat 17 mahalliy konnektor | Moat kuchli, lekin foydalanuvchi "Google Sheets'im bilan ishlamaydi" deb ketadi |
| 1000 konnektorni o'zi yozish | Solo founder uchun **ijro halokati** — poydevor ishi hech qachon boshlanmaydi |
| **Mahalliy 17 ni o'zi + qolganini agregator orqali** | Moat saqlanadi, qamrov ochiladi, ijro yuki chegaralanadi |

**Arxitektura sharti:** agregator **adapter ortida** turadi. Bugungi
`connectors.registry.ts` naqshi (17 konnektor bir interfeys ostida
`[MEASURED]`) aynan shu uchun mos — agregator **18-chi provayder** sifatida
qo'shiladi, parallel tizim sifatida emas.

---

## 4. Qaror jurnali

| Sana | Qaror | ADR |
|---|---|---|
| 2026-08-14 | Konnektor strategiyasi: mahalliy qur + keng sotib ol | ADR-025 |
| 2026-08-14 | Brauzer infratuzilmasi — shartli sotib olish, Contract ADR-010 ustun | ADR-026 |
| 2026-08-14 | Xotira — self-hosted pgvector, tashqi memory SaaS RAD ETILADI | ADR-027 |
| 2026-08-14 | Eval harness — o'zimiz | ADR-028 |
