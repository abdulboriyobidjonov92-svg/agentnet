---
doc: SAFETY_POLICY_LAYER
version: 1.0
status: ACTIVE
created: 2026-08-14
last_verified: 2026-08-14
supersedes: —
superseded_by: —
---

# SAFETY & POLICY LAYER — doimiy qatlam spetsifikatsiyasi

**Sana:** 2026-08-14 · **Versiya:** 1.0 · **Holat:** ACTIVE
**Turi:** **TALAB spetsifikatsiyasi** — implementatsiya emas. Bu hujjat
*nima kafolatlanishi kerakligini* aytadi, *qanday yozilishini* emas.
**Bog'liq:** [`MASTER_ROADMAP_V3.md`](MASTER_ROADMAP_V3.md) §8 · ADR-031 · Contract §7 (SEC-01…SEC-15), §6.5, Konstitutsiya #1–14

> **Bu qatlam bosqich EMAS.** U V3-P0 da minimal shaklda yoqiladi va har
> bosqichda chuqurlashadi. Uni "keyingi bosqichga" ko'chirish taqiqlanadi.

---

## 1. Nega bu qatlam mavjud — "lethal trifecta"

Bugungi platforma bir vaqtda uch narsani qila oladi `[MEASURED]`:

1. **Tashqi dunyoga ta'sir** — SMS yuboradi (Eskiz/PlayMobile konnektorlari),
   Telegram xabar yuboradi, brauzerda amal bajaradi (Playwright API
   jarayonida).
2. **Pul sarflaydi** — LLM chaqiruvi, foydalanuvchi balansi, to'lov yo'llari.
3. **Davlat/huquqiy hujjat topshiradi** — soliq.uz, my.gov.uz, Didox
   konnektorlari.

Bu uchtasi + ishonchsiz model (OSWorld eng yaxshi natija ~72.5%
`[FROM-RESEARCH]`) = **HITL (human-in-the-loop) majburiy**.

Gartner: 2027 oxiriga agentic loyihalarning 40%+ bekor qilinadi — sabablardan
biri **yetarsiz risk nazorati** `[FROM-RESEARCH]`.

---

## 2. Risk tierlari

| Tier | Talab | Misol amallar |
|---|---|---|
| **LOW** | Avtomatik bajariladi, log yoziladi | ma'lumot o'qish, hisobot ko'rish, narx tekshirish, ob-havo/valyuta |
| **MEDIUM** | **Confirmation** — foydalanuvchi bir bosishda tasdiqlaydi | ichki yozuv yaratish, qoralama tayyorlash, agent sozlamasini o'zgartirish |
| **HIGH** | **Explicit approval** — nima qilinishi aniq ko'rsatiladi, foydalanuvchi ataylab tasdiqlaydi | SMS/xabar yuborish, tashqi buyurtma qoralamasini yuborish, brauzerda forma topshirish, konnektor orqali yozish |
| **CRITICAL** | **Dual approval yoki BLOCKED** | pul o'tkazish, davlat hujjatini topshirish, ma'lumotni o'chirish, konnektor sirini o'zgartirish |

### 2.1 Tier belgilash qoidalari

1. **Default = HIGH.** Tier belgilanmagan yangi amal avtomatik `HIGH`
   bo'ladi (Contract Konstitutsiya #2 ning ayni mantiqi: dekoratorsiz
   endpoint = MEMBER).
2. Tier **amal turiga** biriktiriladi, foydalanuvchiga emas.
3. Tierni **pasaytirish** — ADR talab qiladi. Ko'tarish — bemalol.
4. `CRITICAL` amal uchun "avtomatik rejim" **mavjud emas** — hech qanday
   sozlama uni LOW ga tushira olmaydi.

### 2.2 V3-P0 da minimal shakl

V3-P0 da **faqat ikki tier** yoqiladi: `LOW` (avtomatik) va `HIGH`
(tasdiq talab qiladi). `MEDIUM`/`CRITICAL` ajratilishi V3-P2 da qo'shiladi.

**Sabab:** to'rt tierlik to'liq tizimni bugun qurish — foydalanish nuqtasi
yo'q joyda murakkablik (Contract Konstitutsiya #38: o'lik kod taqiqlanadi).
Ikki tier bugun **haqiqiy** amallarga qo'llanadi.

---

## 3. Konnektor limitlari

**Bugungi holat:** 17 konnektor `[MEASURED]`, ularning hech birida
**sarf limiti yoki rate limit yo'q** — `rateLimit|spendCap|dailyLimit|@Throttle`
grep `apps/api/src/connectors/` da **0 moslik** `[MEASURED]`.

### 3.1 Har konnektor uchun majburiy konfiguratsiya

| Parametr | Ta'rif | Default |
|---|---|---|
| `rateLimit` | Vaqt birligida maksimal chaqiruv | `[CALIBRATE]` — konnektor turiga qarab |
| `dailySpendCap` | Kunlik maksimal sarf (tiyin yoki dona) | `[CALIBRATE]` |
| `riskTier` | Bu konnektor orqali amallarning default tieri | SMS/to'lov/davlat = `HIGH`+ |
| `killable` | Kill switch bilan o'chiriladimi | doim `true` |
| `reversible` | Amal qaytariladimi | konnektorga xos (§5) |

### 3.2 Konnektor turlari bo'yicha minimal tier

| Konnektor turi | Minimal tier | Sabab |
|---|---|---|
| SMS (Eskiz, PlayMobile) | **HIGH** | Pul + qonuniy javobgarlik (reklama/spam) |
| To'lov (Payme, Click, Uzum) | **CRITICAL** | Qaytarilmas pul harakati |
| Davlat (soliq.uz, my.gov.uz, Didox) | **CRITICAL** | Huquqiy oqibat |
| Messenger (Telegram, WhatsApp) | **HIGH** | Tashqi dunyoga xabar |
| Email (SMTP) | **HIGH** | Ayni sabab |
| CRM/marketplace yozish (AmoCRM, Bitrix24, Shopify, Uzum Market, WooCommerce) | **HIGH** | Biznes ma'lumotini o'zgartiradi |
| O'qish-only (Google Sheets o'qish, AfterShip status) | **LOW** | Yon ta'sirsiz |

---

## 4. Kill switch

| Talab | Tafsilot |
|---|---|
| **Qamrov** | Har agentda (100%). Sozlama emas — arxitektura xususiyati |
| **Ta'sir** | Faol ijrolar to'xtaydi, navbatdagilar bekor bo'ladi, yangi ijro boshlanmaydi |
| **Kimga** | Foydalanuvchi (o'z agenti), OWNER/ADMIN (har qanday agent) |
| **Tezlik** | `[CALIBRATE]` — maqsad: **<5 soniya** |
| **Audit** | Har ishlatilish `AuditLog`ga (Contract ADR-008) |
| **Global kill** | Butun platforma bo'yicha — faqat OWNER, dual confirmation |
| **Tiklash** | Kill switch **avtomatik** o'chmaydi — qo'lda yoqiladi |

**Test talabi:** kill switch E2E test bilan qoplanadi (V3-P0 gate G0.4).

---

## 5. Reversibility / compensation modeli

Har action sinfi uchun **"undo" nima degani** oldindan yozilgan bo'lishi
SHART. Yozilmagan amal `CRITICAL` sifatida qaraladi.

| Action sinfi | Qaytariladimi | Kompensatsiya |
|---|---|---|
| Ma'lumot o'qish | — | kerak emas |
| Ichki yozuv yaratish | ✅ to'liq | o'chirish |
| Qoralama tayyorlash | ✅ to'liq | qoralamani o'chirish |
| LLM chaqiruvi (pul yechildi) | ⚠️ qisman | refund (Contract Konstitutsiya #21 — xizmat ko'rsatilmasa pul qaytariladi; `idempotencyKey` bilan — `billing.service.ts` `[MEASURED]`) |
| CRM/marketplace yozuvi | ⚠️ qisman | teskari yozuv (agar API qo'llasa) |
| SMS/xabar yuborilgan | ❌ **QAYTARILMAYDI** | faqat tuzatuvchi xabar |
| To'lov bajarilgan | ❌ **QAYTARILMAYDI** | qo'lda refund jarayoni |
| Davlat hujjati topshirilgan | ❌ **QAYTARILMAYDI** | rasmiy tuzatish jarayoni |
| Ma'lumot o'chirilgan (GDPR) | ❌ **QAYTARILMAYDI** | backup'dan tiklash (Contract runbook) |

**Qoida:** qaytarilmaydigan amal **hech qachon** `LOW`/`MEDIUM` bo'la
olmaydi. Bu — jadvalning asosiy maqsadi.

---

## 6. Blast radius izolyatsiyasi

| Chegara | Talab |
|---|---|
| **Foydalanuvchi** | Bir foydalanuvchining agenti boshqasining ma'lumotiga hech qachon tegmaydi (Contract Konstitutsiya #3/#4 — tenant scoping, ESLint bilan majburlangan `[FROM-AUDIT]`) |
| **Agent** | Bir agentning xatosi boshqa agentni to'xtatmaydi |
| **Konnektor** | Bir konnektor limitiga urilishi boshqasini bloklamaydi |
| **Ijro** | Bir ijro maksimal davomiylik/xarajat chegarasiga ega (`[CALIBRATE]`) |
| **Servis** | Brauzer ishi API SLO'siga ta'sir qilmaydi — ⚠️ **bugun buzilgan**: Chromium API jarayonida `[MEASURED]` (Contract A21/ADR-010 bajarilmagan) |
| **Global** | Kunlik global LLM cap mavjud (`USAGE_GLOBAL_LLM_PER_DAY=2000` `[MEASURED]`) |

---

## 7. Browser domain allowlist (Contract SEC-07)

**Holat:** Contract §7 da tavsiflangan, **hali bajarilmagan**.

| Talab | Manba |
|---|---|
| Har run boshlanishida ruxsat etilgan domenlar ro'yxati (maks. 5) | Contract SEC-07 AC |
| `page.route()` boshqa domenga navigatsiyani bloklaydi | Contract SEC-07 AC |
| Faqat shu domenlarning cookie'lari in'ektsiya qilinadi (`mergeStorageStates` **filtrlanadi**) | Contract SEC-07 AC |
| Blok hodisasi `DeviceActionLog`ga `status: blocked` bilan yoziladi | Contract SEC-07 AC |

**Nega bu "lethal trifecta" himoyasi:** prompt injection bilan agent
boshqa saytga olib ketilsa, u yerda foydalanuvchi sessiyasi bilan amal
bajaradi. Allowlist — bu hujum sinfining asosiy to'sig'i.

**V3 da:** V3-P2 ish elementi (P2.4).

---

## 8. Approval hodisasi modeli (moat)

Approval **UI elementi emas — ma'lumot aktivi** (§2 M3).

| Maydon | Nega kerak |
|---|---|
| `actionId`, `agentId`, `userId` | Kontekst |
| `riskTier` | Qaysi tierda so'raldi |
| `proposedAction` (to'liq) | Agent nima taklif qildi |
| `decision` (`approved`/`rejected`/`modified`) | Inson qarori |
| `modifiedAction` (agar `modified`) | ⭐ **Eng qimmatli maydon** — inson nimani tuzatdi |
| `latencyMs` | Qaror qancha vaqt oldi (ishonch signali) |
| `reason` (ixtiyoriy) | Nega rad etdi |

**Qoida:** `modified` holati **alohida** saqlanadi. "Rad etdi" va "tuzatib
tasdiqladi" — butunlay boshqa signal, ularni bitta `boolean`ga siqish
moatni yo'q qiladi.

---

## 8bis. Ma'lumot siyosati — Free tier LLM provayderi

**Holat:** OCHIQ QABUL QILINGAN XAVF (2026-08-16). Yashirilmaydi, kamaytirib
ko'rsatilmaydi.

Free tier OpenRouter'ning `:free` modellari orqali ishlaydi (qarang
[`PRICING_ARCHITECTURE.md`](PRICING_ARCHITECTURE.md) §3.0). OpenRouter
hujjatiga ko'ra `[FROM-RESEARCH]` (openrouter.ai/docs/features/privacy-and-logging,
2026-08): bepul va pullik modellar uchun **alohida** sozlama bor va ba'zi
provayderlar so'rovlarni **o'z modellarini o'qitishga ishlatishi mumkin**.
Hisob sozlamalarida "training"dan voz kechilsa, OpenRouter shunday
provayderlarga **marshrutlamaydi**.

| Tier | Provayder | Ma'lumot rejimi | Kim uchun maqbul |
|---|---|---|---|
| **Free** | OpenRouter `:free` | Provayderga qarab **o'qitishga tushishi mumkin** | Sinov, shaxsiy vazifalar, ochiq ma'lumot |
| **Pro / Business / Enterprise** | Anthropic (to'g'ridan-to'g'ri, DPA'li) | O'qitishga **tushmaydi** | Mijoz ma'lumoti, tijorat siri, shaxsiy ma'lumot |

**Majburiy qoidalar:**

1. **Hisob sozlamasi:** OpenRouter hisobida "model training" dan **voz
   kechilgan** bo'lishi kerak — bu bitta marta bosiladigan sozlama va u
   `no-train` provayderlarga marshrutlashni ta'minlaydi. Imkon qadar shu
   siyosatdagi modellar tanlanadi.
2. **Tier chegarasi qat'iy:** pullik tier **hech qachon** OpenRouter orqali
   ketmaydi. Kodda bu zanjirlar butunlay ajratilgan (`tier == "free"`
   shoxi `streaming.py` da) — "vaqtincha arzonlashtirish" uchun ham
   aralashtirilmaydi.
3. **Foydalanuvchiga oshkor qilish:** Free tarif sahifasida bu band ochiq
   yoziladi (mahsulot ishi — hali bajarilmagan, quyidagi gate'ga qarang).
4. **Tijorat ma'lumoti:** Free tarifda mijoz bazasi, to'lov ma'lumoti yoki
   shaxsiy ma'lumot bilan ishlash **tavsiya etilmaydi** — bu Pro'ga o'tish
   uchun halol va real sabab.

**Nega bu xavf qabul qilinadi:** alternativa — free tier'ning umuman
bo'lmasligi (founder byudjeti nol). Bepul qatlamsiz konversiya funnel'i
1-qadamda o'ladi. Xavf **cheklangan** (free tarif ataylab sinov uchun) va
**oshkor** (yuqoridagi 3-qoida).

---

## 9. Contract bilan bog'lanish

| Bu hujjat | Contract | Munosabat |
|---|---|---|
| Risk tierlari | §6.5 (xavfli **admin** amallari) | **Kengaytirish**: Contract admin amallarini qamraydi, bu hujjat **agent** amallarini |
| Kill switch (agent) | — | **YANGI** |
| Konnektor limitlari | A19/A20 (Redis throttler) | Kengaytirish — infratuzilma mavjud, siyosat yo'q |
| Domain allowlist | SEC-07 | **O'zgarishsiz** — Contract bandi |
| Approval logging | ADR-008 (audit zanjiri) | Kengaytirish — audit bor, approval **hodisa modeli** yo'q edi |
| Reversibility | Konstitutsiya #21 (refund) | Kengaytirish — pul yo'lidan tashqari amallarga |
| Blast radius | Konstitutsiya #3/#4, A21 | O'zgarishsiz + A21 ning bajarilmagani qayd etilgan |
| Dual approval | §6.5 (2FA re-auth) | Mos — ayni ruh |

---

## 10. Bu qatlam uchun EXIT GATE'lar

| Bosqich | Gate |
|---|---|
| V3-P0 | 17/17 konnektorda limit; 100% agentda kill switch; HIGH-risk chetlab o'tish 0; approval jurnali ≥1 hafta |
| V3-P1 | Free tier cost cap ishlaydi (cheksiz sarf 0 hodisa); **§8bis ma'lumot siyosati Free tarif sahifasida foydalanuvchiga oshkor qilingan** |
| V3-P2 | Domain allowlist: 0 muvaffaqiyatli ruxsatsiz navigatsiya; 4 tierlik model to'liq |
| V3-P3 | Retail vision: biometrik savollar (§9 B1–B6) yozma javob olgan |
| V3-P4 | Audit export + org-darajasidagi approval oqimi |
