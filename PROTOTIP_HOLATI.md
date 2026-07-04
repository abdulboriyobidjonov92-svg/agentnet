# AgentNet — Prototip holati ✅

**Sana:** 2026-07-04 (CTO audit + Pricing/Pro obuna yakunlandi)
**Holat:** Adaptiv yadro + 5 flagman imkoniyat + Super Mode (Part 1) +
**JAHON DARAJASIDAGI DIZAYN TIZIMI (3D)** + **AgentOS enterprise liniyasi** (Part 2) +
**PLATFORMA SUPERKUCHLARI** (Part 1B: brauzer-avtomatlashtirish, Connector SDK,
compliance packlar, retail fuziyasi, biznes-operatsiyalar, tashqi savdo, GovTech,
marketplace bozor mexanikasi).
Deploy'ga to'liq tayyor (artefaktlar + guide); jonli chiqarish akkaunt kutmoqda.

## YANGI: CTO audit + Pricing/Pro obuna (2026-07-04)

### To'liq audit — barcha modullar jonli tekshirildi
14 modul curl bilan jonli sinovdan o'tdi: onboarding/role-detect (fermer→
agriculture 80% ✓), twin faktlar + what-if ✓, goals dekompozitsiya ✓, fusion ✓,
ethics (verdikt + audit log ✓), knowledge (jonli USD=11 950 UZS, manba+URL ✓),
connectors (17 katalog ✓), marketplace ✓, retail (shelf_empty→discrepancy alert ✓),
operations payroll ✓, trade tariff (HS 85 ✓), govtech katalog ✓, agentos
(workspace→command→bo'lim natijalari + ethics ✓), billing/usage ✓.
Ilgari shubha qilingan muammolar allaqachon hal bo'lgan edi: dashboard real
statistika, marketplace UI'da ichki ID ko'rinmaydi, connector'lar halol
`needs_credentials` qaytaradi.

### Tuzatishlar (qabul mezonlariga moslash)
- **Twin what-if:** timeline 1/3/6 oy → **3/6/12 oy** (LLM prompt + heuristik,
  uch tilda). Javob 3 bo'limli: prognoz (summary+assumptions), fakt havolalari
  (used_facts), ssenariylar (timeline). O'zbekcha tekshirildi ✓.
- **Fusion:** rol-tanlash hint'lari kengaytirildi (sog'liq/soglig/salomat,
  kredit/qarz/foiz, solig', qurilish/issiqxona — uz/ru/en); fallback endi
  kamida **3 ekspert** beradi. Test: kredit+soliq+sog'liq savoli →
  accountant+engineer+doctor ✓.

### YANGI: /pricing sahifasi + Pro obuna (haqiqiy mexanika)
- **Sxema:** `User.proUntil` (DateTime?) — Pro muddati; o'tgach limitlar
  avtomatik free'ga qaytadi (`UsageService.effectivePlan`, soxta pro yo'q).
- **Endpointlar:** `GET /api/billing/plans` (env'dagi haqiqiy narx/limitlar),
  `POST /api/billing/upgrade-pro` — prepaid balansdan 30 kunlik obuna atomik
  yechiladi (balans yetmasa halol 402), `CreditLedger`ga `kind: subscription`
  yozuvi. Faol obuna ustiga olinsa muddat oxiridan davom etadi.
- **UI:** `/pricing` — 3 karta (Bepul / Pro / Enterprise·AgentOS), 3 tilda,
  haqiqiy limitlar API'dan, joriy tarif + amal muddati ko'rsatiladi; sidebar'da
  "Tariflar" bandi (Gem) va AgentOS'dagi **PRO chip endi /pricing'ga olib boradi**.
- **Env:** `BILLING_PRO_MONTH_TIYIN` (default 2 500 000 = 25 000 so'm/oy) —
  `.env.example` va `render.yaml`ga qo'shildi.
- **Tekshirildi:** bo'sh balans → 402 ✓; 30 000 so'm to'ldirish → upgrade →
  plan=pro, 500 xabar/kun, 100 agent, ledger -25 000 ✓; sahifa o'zbekcha render ✓;
  production build o'tadi (`/pricing` route ✓); web+api tsc toza ✓.

### E2E regressiya (2026-07-04, yangi foydalanuvchi bilan)
signup → o'zbekcha onboarding (do'kon egasi) → retail/80% aniqlandi → tavsiya
agent o'rnatildi → o'z agenti yaratildi (retail vertical avto) → balanssiz chat
→ halol 402 → to'ldirish → chat stream jonli ob-havo tool bilan javob berdi
(demo_mode: true belgisi) → ethics verdict audit logda → marketplace'ga 2 000
so'mga publish → boshqa foydalanuvchi install → CreatorLedger'ga 1 400 so'm
(70%) ✓ → faqat o'rnatgan foydalanuvchi baho qo'ydi ✓.

### Eslatma
SQLite'da schema o'zgarishi `prisma db push` bilan qo'llandi (migrate emas).
Jonli deploy hali ham GitHub + Render/Vercel akkauntlarini kutmoqda.

## YANGI: Part 1B — Platforma superkuchlari (2026-07-03)

Barcha 8 bo'lim qurildi va **haqiqiy kirishlar bilan tekshirildi** (quyida har birida
tekshiruv natijasi). Naqsh o'zgarmadi: LLM-first + halol heuristik fallback,
har kirish Halal Filter'dan o'tadi.

### S1. Universal App Control — Tier 1: brauzer-avtomatlashtirish ✅
- **Arxitektura:** Playwright (Chromium) NestJS "browser bridge"da; har qadam
  QARORI engine'da (`automation_planner.py` — LLM sahifa holatiga qarab mulohaza
  yuritadi; kalitsiz skriptli retseptlar: URL ochish, forma to'ldirish, o'qish).
- **Yo'llar:** `/automation` sahifasi; `POST /api/automation/run`; agent-vositasi
  `web.automate` (istalgan agent toolsConfig'iga qo'shiladi, demo-chatda ham ishlaydi).
- **Model:** `AutomationRun` — qadam jurnali + natija + method.
- **Tekshirildi:** example.com ochib matn o'qidi ✓; httpbin.org formasini haqiqiy
  to'ldirdi ✓; URLsiz maqsad → halol fail ✓; "kazino" maqsadi → blocked ✓.
- **Tier 2 (native OS)** ATAYLAB qurilmadi — halol texnik yo'l `ROADMAP_WOW_FEATURES.md`da.

### S2. Connector SDK — 17 connector ✅
- **SDK:** `apps/api/src/connectors/` — yagona interfeys (auth sxemasi + action
  sxemasi + data sxemasi), registry, `ConnectorConfig` jadvali. Yangi integratsiya =
  bitta fayl. Qo'llanma: `docs/CONNECTOR_SDK.md`.
- **Connectorlar:** Telegram, WhatsApp Business, Eskiz SMS (UZ), Playmobile SMS (UZ),
  SMTP email, Bitrix24, amoCRM, Shopify, WooCommerce, Uzum Market (UZ), Payme (UZ),
  Click (UZ), Google Sheets, Didox e-faktura (UZ), AfterShip; my.gov.uz va soliq.uz —
  halol `agreement_required` stub (sxema tayyor).
- **Agent-vositasi:** `connector.invoke` — agentlar istalgan ulangan integratsiyani chaqiradi.
- **Tekshirildi:** katalog 17 ✓; kredensialsiz configure → `needs_credentials` ✓;
  soxta token bilan invoke → haqiqiy Telegram API xatosi ("Unauthorized") halol qaytdi ✓;
  my-gov-uz → `needs: agreement` ✓. UI: `/connectors`.

### S3. Vertical Compliance Packs ✅
- `compliance_packs.py`: healthcare, finance, government, legal, retail, trade —
  har birida majburiy tizim-prompt qoidalari, 3 tilda disclaimer, taqiqlangan-da'vo
  regexlari, data-qoidalar. Ethical Decision Engine O'RNIGA EMAS — yoniga.
- **Avtomatik yuklanadi:** Agent'da `vertical` maydoni; onboarding shablonlari
  domenidan avto-belgilanadi; streaming'da pack tizim-promptga qo'shiladi,
  chiqishda disclaimer/violation eventi (`disclaimer`, `compliance_flag`).
- **Tekshirildi:** "You definitely have cancer. No need to see a doctor" → 2 ta
  violation ✓; "guaranteed profit" → finance violation ✓; jonli streamda healthcare
  agenti javobiga o'zbekcha disclaimer qo'shildi ✓.

### S4. Retail Intelligence — kamera + inventar FUZIYASI ✅
- **Naqsh:** vision-hodisa hech qachon o'zi signal emas — POS savdolari va inventar
  bilan solishtiriladi (`RetailService.reconcileAndAlert` + `retail_intel.py`
  kontekstli baho). Modellari: RetailProduct/Sale/VisionEvent/Alert/Settings.
- **"Bu tovar tugadi" o'zi keladi:** alert egasi tanlagan kanalga (Telegram/SMS/
  WhatsApp/email — Connector SDK orqali) avtonom yuboriladi, dashboard kutmaydi.
- **CV webhook:** `POST /api/retail/vision-events` — haqiqiy kamera-servis shu yerga uradi.
- **Tekshirildi:** shelf_empty + zaxira 0 → CRITICAL stockout, o'zbekcha xabar ✓;
  kamera "bo'sh" lekin hisobda 24 → discrepancy ✓; pickup POS cheksiz → theft_suspect
  (ayblovsiz) ✓; buzuq hodisa (alien_invasion, noma'lum SKU) → graceful ✓;
  kanal sozlangach haqiqiy yuborish urinishi (soxta token → halol `failed`) ✓. UI: `/retail`.

### S5. Business Operations Agent ✅
- Xodimlar, **tabiiy tildan smena jadvali** (`business_ops.py` — LLM-first;
  kalitsiz ham "Alisher juma ishlamaydi"ni tushunadigan cheklov-parser),
  ta'til so'rovlari, **payroll-yaqin hisob** (soat × stavka, soliq YO'Q — halol
  chegara), **tashqi xabarlar**: agent qoralaydi → ega tasdiqlaydi → Connector
  SDK orqali haqiqiy yuboriladi. Modellari: Employee/Shift/TimeOff/OutboundMessage.
- **Tekshirildi:** 3 xodim, "9-21, 2 kishi, Alisher juma ishlamaydi" → 14 smena,
  jumada Alisher yo'q ✓; payroll 84 soat / 1 890 000 so'm to'g'ri ✓; mijozga
  qoralama → tasdiq → yuborish urinishi (halol failed holati) ✓. UI: `/operations`.

### S6. Cross-Border Trade Agent ✅
- `trade.py`: bojxona hujjatlari (eksport/import to'plamlari + invoice qoralama),
  tarif ma'lumotnomasi (HS bo'limlar + UZ boj/QQS taxminlari, "rasmiy manbada
  tasdiqlang" disclaimeri bilan), muvofiqlik skriningi (dual-use + embargo
  ro'yxatlari), trek-raqamdan tashuvchi aniqlash (jonli kuzatuv AfterShip
  connectori bilan), jonli valyuta (open.er-api).
- **Tekshirildi:** "smartfon" → HS 85, 10%/12% ✓; eksport meva → 8 hujjat ✓;
  "drone/night vision → Iran" → 4 flag ✓; paxta → clear ✓; 1Z... → UPS ✓;
  USD=11 912 UZS jonli kurs ✓. UI: `/trade`; builtin shablon "Cross-Border Trade Agent".

### S7. GovTech vertikali ✅
- `govtech.py` + `CitizenRequest`: murojaat intake → tasnif (7 kategoriya,
  LLM-first + 3 tilli keyword fallback) → mas'ul idoraga marshrut → timeline'li
  holat kuzatuvi. **Jarayon navigatori:** 8 ta ko'p bosqichli guide (pasport,
  propiska, YaTT, metrika, pensiya, nikoh, kadastr, prava).
- **Halol chegara:** har javobda `live: false` — jonli topshirish uchun rasmiy
  data-sharing shartnomasi + my.gov.uz API kerakligi ochiq yozilgan.
- **Tekshirildi:** "gaz hidi... suv yo'q... bolalar xavf" → utilities/URGENT ✓;
  "pasport olish" → to'liq 4-bosqichli guide ✓; keraksiz matn → yagona darchaga
  triage (yiqilmaydi) ✓; holat advance + timeline ✓. UI: `/govtech`.

### S8. Marketplace bozor mexanikasi ✅
- **Reyting:** score = foydalanish + o'rnatishlar×5 + baho×soni×2 + verified bonus;
  leaderboard rank bilan. **Verified belgisi:** ≥10 foydalanish va ≥90% muvaffaqiyat.
- **Haqiqiy signal:** suhbat saqlanganda o'rnatilgan agent → manba agentga
  usage/success yoziladi (conversations hook, `sourceAgentId` atributsiyasi).
- **Baholar:** faqat haqiqatan o'rnatganlar (reyting soxtalanmaydi).
- **Daromad:** pulli o'rnatish → `CreatorLedger`ga 70/30 split (haqiqiy buxgalteriya);
  payout so'rovi balansni yopadigan yozuv (to'lov protsessingi stub — ochiq yozilgan).
- **Tekshirildi:** 5 000 so'mlik agent publish → install → ledger 3 500/1 500 ✓;
  11 haqiqiy suhbat almashinuvi → usage 11, verified=true, rank #1 ✓; o'rnatmagan
  foydalanuvchi bahosi → 403 ✓; payout → stub_pending yozuvi ✓. UI: marketplace qayta qurildi.

### S9. Kesuvchi printsip — qoida emas, mulohaza
Har yangi agent xulqi LLM-first (Claude kaliti bilan chuqur kontekstli mulohaza);
fallbacklar ham dalil-asosli va buzuq kirishda gracefully ishlaydi (yuqoridagi
har bo'limda buzuq-kirish testi bor). `method: llm|heuristic` belgisi hamma joyda.

### Yangi env o'zgaruvchilar
- `INTERNAL_API_TOKEN` — engine↔API ichki chaqiruvlar (default: dev qiymat)
- `API_URL` — engine'dan NestJS'ga (default http://localhost:3001)
- Playwright: `apps/api`da o'rnatilgan (`npx playwright install chromium` bajarilgan)

## YANGI: Part 2 — Dizayn tizimi + AgentOS (2026-07-02)

### Deep-space dizayn tizimi (3D + liquid glass)
- **Ranglar:** deep space black (asosiy dark rejim), electric cyan + emerald imzo,
  binafsha-ko'k gradientlar, me'yorida oltin. Sayqallangan light rejim ham bor.
- **Tokenlar:** `globals.css` to'liq qayta yozildi — glassmorphism (`.glass-panel`),
  neon nur (`.shadow-glow`), global suyuq to'lqin (ripple) har bosishда,
  `.aurora`, `.scanline` va h.k. Barcha eski sahifalar tokenlar orqali avtomatik kiyindi.
- **Dark — default:** `layout.tsx` skript endi dark'ni standart qiladi.

### 3D ekranlar (three.js + @react-three/fiber, kod-split, ssr:false)
- **Splash/landing:** aylanuvchi **neyron sfera** (bog'langan yorug' nuqtalar) +
  **zarrachali "AgentNet" logotipi** (2D canvas particle assemble).
- **Dashboard:** markaziy **Personal Orb** (Life Twin langari) — agentlar orbitada
  aylanadi, orb bosilsa holat paneli, agent tuguni bosilsa chat; sekin fon zarrachalari.
  Kasbga qarab **rol-sahnasi** (healthcare→EKG+yurak, government→statistika ustunlari,
  agriculture→maysa+quyosh).
- **Agent Creator:** chap — no-code forma, o'ng — **jonli 3D motif** (vosita tanlangani
  sari yig'iladi: ko'z=monitoring/bilim, kristall=moliya, kitob=ta'lim, barg=agri...).
  Agent yaratilganda **zarrachali fireworks**.
- **Life Twin:** what-if natijasi **3D shoxlanuvchi kelajak yo'llari** bilan
  (davrlar shoxlanadi, tugun ustiga borilganda bashorat ochiladi).
- **Perf byudjeti:** dpr [1,1.5], low-power qurilmada kam nuqta, reduced-motion'da
  demand-frameloop, three.js faqat 3D sahifalarda yuklanadi. Production build o'tadi.

### AgentOS — enterprise liniyasi (Part 1 Org/Agent modelining kengaytmasi)
- **Sxema:** Org'ga `kind/tier/industry/ownerId`; Agent'ga `csuiteRole`; yangi
  `OrgCommand` jadvali. Bitta hisob ham shaxs (Life Twin), ham tashkilot bo'la oladi.
- **C-suite:** ish maydoni yaratilganda **5 ta agent** (AI-CEO/CFO/CMO/CLO/CTO)
  Part 1 Agent modelida avtomatik urug'lanadi — alohida tizim emas.
- **Flagman oqim:** rahbar bitta buyruq beradi → engine orkestratori (`agentos.py`)
  bo'ladi va C-suite rollariga yo'naltiradi → har bir natija **Ethical Decision
  Engine'dan** o'tadi → bitta **rahbariyat xulosasiga** yig'iladi. LLM-first + heuristik.
- **UI:** `/agentos` command-center — ish maydoni setup, C-suite tarmog'i, buyruq
  kiritish, bo'lim natijalari (ethics verdikti bilan), yig'ma hisobot, fireworks.
  Sidebar'da "Pro" belgili enterprise ko'rinish.
- **Endpointlar:** `POST/GET /api/agentos/workspace`, `POST /api/agentos/command`,
  `GET /api/agentos/history`, `GET /api/agentos/csuite`; engine `/agentos/run`, `/agentos/csuite`.

### Deploy tayyorligi
- `apps/api/Dockerfile` (build vaqtida sqlite→postgresql, prisma migrate deploy),
  `apps/agent-engine/Dockerfile` ($PORT), `render.yaml` (3 servis + Postgres bitta faylda),
  `apps/web/vercel.json`, `DEPLOYMENT.md` (bosqichma-bosqich).
- Postgres schema varianti tekshirildi (`prisma validate` ✓). Git init + commit qilindi (158 fayl).
- **Sizdan kerak:** GitHub repo + Render (yoki Vercel) akkaunti. Bularsiz jonli
  URL berilmaydi (login kerak). Batafsil — `DEPLOYMENT.md` va yakuniy hisobot.

### Part 1/2 regressiya
Fusion (shifokor+advokat+buxgalter), Goals (progress), Twin (what-if+3D timeline),
AgentOS (to'liq oqim), light+dark rejim, halal blok — barchasi yangi dizaynda tekshirildi.

## YANGI: Beshta "wow" imkoniyat + Super Mode (Part 1, 2026-07-02)

Barchasi bitta naqshda: **LLM-first** (ANTHROPIC_API_KEY bo'lsa Claude chuqur
mulohaza qiladi) + **heuristik fallback** (kalitsiz ham mazmunli ishlaydi,
`method: "heuristic"` belgisi bilan). Har bir kirish Halal Filter'dan o'tadi.

### 1. Life Twin — `/twin` sahifasi
- `TwinFact` jadvali — kategoriyalangan hayotiy faktlar (moliya, oila, sog'liq...).
- Manbalar: onboarding avtomatik urug'laydi, **suhbatlardan fon rejimida
  ajratiladi** (conversations hook), qo'lda qo'shish.
- **What-if:** haqiqiy faktlar bilan 1/3/6-oylik ssenariy prognozi.
  Fallback rejimda ham haqiqiy arifmetika (narx vs daromad ulushi).
- Engine: `life_twin.py`; API: `/api/twin/*`.

### 2. Autonomous Goal Achievement — `/goals` sahifasi
- Maqsad oddiy tilda → `goal_engine.py` bosqich/vazifa/agent-rol/kadansga ajratadi.
- **Har kuni 07:00 cron** faol maqsadlarning navbatdagi 2 vazifasini o'zi
  bajaradi (natija-matn ishlab chiqaradi); "Hozir yuritish" tugmasi ham bor.
- Progress avtomatik; natijalar task ichida saqlanadi.
- API: `/api/goals`, `/api/goals/:id/advance`; jadval: `Goal`, `GoalTask`.

### 3. Cross-Profession Agent Fusion — `/fusion` sahifasi
- 8 ekspert-rol (shifokor, advokat, buxgalter, biznes-maslahatchi, pedagog,
  islomiy odob maslahatchisi, davlat-idora mutaxassisi, muhandis).
- Muammodan rollar avtomatik tanlanadi (yoki qo'lda) → har birining tahlili +
  ziddiyatlar + **bitta yaxlit xulosa** + amal rejasi.
- Engine: `fusion.py`; API: `POST /api/fusion`.

### 4. Ethical Decision Engine — Sozlamalar → "Qadriyatlarim"
- `User.valuesProfile` — an'ana (islomiy/dunyoviy/aralash) + qadriyat bayonlari.
- Ikki bosqich: **mavjud Halal Filter qayta ishlatiladi** (BLOCK → REJECT),
  keyin qadriyatlar qatlami → APPROVE/CAUTION/REJECT + sabab.
- Super Mode har bir amalni shu orqali tekshiradi.
- Engine: `ethics.py`; API: `POST /api/ethics/evaluate`, `GET/PATCH /api/users/me/values`.

### 5. Real-time Global Knowledge Sync
- Jonli manbalar (kalitsiz): **Google News RSS**, **Wikipedia**, valyuta
  (open.er-api), ob-havo (Open-Meteo) — barchasi manba+URL+vaqt atributsiyasi bilan.
- `knowledge.search` **agent tool** sifatida ro'yxatda — agent yaratishda tanlanadi;
  demo-chat "news/yangilik" so'rovlarini jonli manbalarga yo'naltiradi.
- Engine: `knowledge_sync.py`; API: `POST /api/knowledge/search`.

### ⚡ "One Command" Super Mode — `/supermode` sahifasi
Beshtasi birga, 6 bosqichli real kompozitsiya: Kontekst (Twin+maqsadlar+kalendar)
→ Kun rejasi → Agent natijalari (rollar bo'yicha) → Axloq tekshiruvi (har amal)
→ Jonli ma'lumot (manbali) → Hisobot. Engine: `supermode.py`; API: `POST /api/supermode`.

**Backlog:** qolgan 13+ g'oya feasibility izohlari bilan `ROADMAP_WOW_FEATURES.md`da.

**Part 1 yakuniy tekshiruv (2026-07-02, brauzer + curl):** twin faktlari va
what-if UI'da ✓; maqsad yaratish + "Hozir yuritish" 40%→80% ✓; fusion
shifokor+advokat+buxgalter avto-tanlovi ✓; qadriyatlar saqlash + riba REJECT ✓;
jonli yangiliklar agent-chatda manba bilan ✓; Super Mode 6 bosqich UI'da ✓;
halal blok chat/onboarding/goals/fusion kirishlarida ✓; suhbat + audit DB'da ✓.
Tuzatildi: fusion doctor-hints kengaytirildi; kirill "млн/тыс" pul regexi;
noma'lum kasb twin'ga yozilmaydi. Eslatma: Windows'da curl bilan kirill matn
yuborishda `--data-binary @file.json` ishlating (shell UTF-8 buzadi).

## YANGI: Adaptiv yadro (2026-07-02)

Platformaning asosiy vizioni — "har qanday kasb egasiga moslashish" — endi ishlaydi:

**Oqim:** Ro'yxatdan o'tish → `/onboarding` sahifasi → foydalanuvchi o'zi haqida
erkin matnda yozadi (istalgan tilda) → tizim kasb/soha'ni aniqlaydi → kasbga mos
tavsiya agentlar bir bosishda yaratiladi → dashboard kasbga moslashadi
(soha nomi, kasb, tezkor amallar, tavsiya agentlar).

**Qanday ishlaydi:**
- `apps/agent-engine/role_detection.py` — 16 soha taksonomiyasi (tibbiyot, huquq,
  davlat xizmati, ta'lim, qishloq xo'jaligi, savdo, moliya, IT, qurilish, transport,
  oziq-ovqat, sanoat, din, media, sport, umumiy). Har biriga: uz/ru/en keyword'lar,
  tavsiya agent shablonlari (3 tilda nom/tavsif), dashboard vidjetlari, tezkor amallar.
- Aniqlash **LLM-first** (Claude, API kaliti bo'lsa) + **keyword fallback**
  (demo rejimda ham to'liq ishlaydi, ishonch 0.5–0.85).
- Onboarding matni ham **Halal Filter'dan o'tadi** — bloklangan matn profil bo'lmaydi.
- Yangi endpointlar (FastAPI): `POST /role/detect`, `GET /role/domains`, `GET /role/domains/{slug}`
- Yangi endpointlar (NestJS): `POST /users/me/onboarding`, `GET /users/me/recommendations`,
  `POST /users/me/recommendations/install`
- Prisma `User` modeliga qo'shildi: `professionTitle, domain, domainConfidence,
  onboardingText, goals, profileData, onboardingCompleted, preferredLanguage, city`
- Web: `/onboarding` sahifasi (yangi), dashboard kasbga moslashdi (banner, hero,
  tezkor amal chiplari, "Siz uchun tavsiya" kartalari), sign-up endi onboarding'ga yo'naltiradi.

**E2E tekshirilgan (2026-07-02):** signup → "I am a farmer near Fergana..." →
Farmer/Agriculture/85% → 2 agent o'rnatildi → dashboard "Agriculture" rejimida →
tezkor amal chat'ga prefill → demo stream javob → "kazino" xabari bloklandi →
suhbat DB'ga saqlandi → audit log'da onboarding.complete yozuvi bor.

## YANGI: Suhbat xotirasi va davomiyligi (2026-07-02)

- Chat endi **oxirgi 20 xabarni kontekst sifatida** engine'ga yuboradi
  (haqiqiy Claude rejimida ko'p-navbatli suhbat ishlaydi).
- Har bir almashinuv **DB'ga saqlanadi** (`POST /conversations/:id/messages/bulk` — yangi).
- Halal Filter endi **kasb kontekstini** hisobga oladi (shifokorning klinik savoli
  bilan oddiy foydalanuvchi savoli farqlanadi — LLM qatlamida).
- Blocklist kengaytirildi: qimor/riba/narkotik/fitna — uz/ru/en pattern'lar.

## Hozir nima ishlayapti

| Servis | Manzil | Holat |
|---|---|---|
| Next.js (web UI) | http://localhost:3000 | ✅ ishlayapti |
| NestJS (API) | http://localhost:3001/api/docs | ✅ ishlayapti |
| FastAPI (agent-engine) | http://localhost:8000/docs | ✅ ishlayapti |
| Ma'lumotlar bazasi | SQLite (`apps/api/prisma/dev.db`) | ✅ migratsiya qilingan |
| Autentifikatsiya | Clerk **keyless rejim** (avtomatik) | ✅ ishlayapti |

## Docker shart emas edi

Kompyuterda Docker yo'q edi, shuning uchun:
- **Postgres → SQLite** ga o'tkazildi (`apps/api/prisma/dev.db`). Hech qanday tashqi DB kerak emas.
- Redis ishlatilmaydi (prototip uchun shart emas).

## Demo rejim (muhim)

Tizimdagi Claude tokeni oddiy API uchun yaramadi (401), shuning uchun agent-engine
**demo rejimda** ishlayapti:

- ✅ **Halal filter** to'liq ishlaydi — "kazino", "qimor", "riba" kabi so'zlar bloklanadi
- ✅ **Namoz vaqtlari** — Aladhan API'dan haqiqiy ma'lumot (bepul, kalit kerak emas)
- ✅ **Qur'on suralari** — AlQuran.cloud API'dan haqiqiy oyatlar (o'zbekcha tarjima)
- ✅ **Token-token oqim** (streaming) ishlaydi
- ⚠️ Erkin suhbat javoblari shablon — **haqiqiy Claude aqli uchun** quyidagini qiling:

### Haqiqiy Claude javoblarini yoqish

`apps/agent-engine` papkasida `.env` fayl yarating:
```
ANTHROPIC_API_KEY=sk-ant-...   # console.anthropic.com dan
```
Keyin agent-engine'ni qayta ishga tushiring. Demo rejim avtomatik o'chadi.

## Foydalanish (1 ta qadam sizdan)

1. Brauzerда **http://localhost:3000** oching
2. **"Ro'yxatdan o'tish"** bosing → Clerk keyless test akkaunt yaratadi (email + parol)
3. Dashboard ochiladi → **"Yangi agent"** → nom, system prompt, vositalar tanlang
4. Agentni yarating → suhbatni boshlang
5. Sinab ko'ring: *"Toshkentda bugungi namoz vaqtlari?"* yoki *"Fotiha surasini o'qib ber"*
6. Halal filterni sinash: *"kazino haqida"* yozing → bloklanadi 🚫

## Qayta ishga tushirish

Agar servislar to'xtab qolsa:
```bash
cd C:/Users/User/Claude/Projects/agentnet
bash start-all.sh
```

Yoki alohida:
```bash
# FastAPI
cd apps/agent-engine && .venv/Scripts/python -m uvicorn main:app --port 8000 --reload
# NestJS
cd apps/api && npm run dev
# Next.js
cd apps/web && npm run dev
```

## Sizdan kerak bo'ladigan narsalar (kalitlar/hisoblar)

| Nima | Nima uchun | Holat |
|---|---|---|
| `ANTHROPIC_API_KEY` (`apps/agent-engine/.env`) | Haqiqiy Claude javoblari, aqlli kasb-aniqlash, LLM halal-qatlami | ⚠️ Yo'q — demo rejim |
| `TELEGRAM_BOT_TOKEN` (`apps/api/.env`) | Telegram xabar yuborish agentlari | ⚠️ Yo'q — faolsiz |
| Clerk kalitlari | Production auth (hozir lokal dev-login ishlaydi) | ⚠️ Keyless |
| Payme/Click sandbox | Bank integratsiyasi (`bank_connector.ts` adapter tayyor) | ⚠️ Ariza kerak |
| Kamera (RTSP/ONVIF) va CV xizmati | Do'kon monitoring | ❌ Hali qurilmagan |

## Texnik o'zgarishlar (bu sessiyada)

- Prisma: `postgresql` → `sqlite`; `Role` enum → String (SQLite enum'ni qo'llamaydi)
- `agent_engine.py`: langgraph/numpy importlari ixtiyoriy qilindi (Python 3.14 mosligi)
- `halal_filter.py`: LLM qatlami API'siz ham ishlaydi (keyword'ga tayanadi)
- `streaming.py`: demo rejim qo'shildi (API'siz to'liq oqim + haqiqiy tool'lar)
- `clerk.guard.ts`: JIT foydalanuvchi yaratish (webhook'siz lokal rejim uchun)
- SSE formati tuzatildi (ikki marta `data:` prefiksi muammosi)
- O'zbekcha apostrof xatosi tuzatildi (`noto'g'ri` → ikki tirnoq)

## Texnik o'zgarishlar (2026-07-02 sessiyasi)

- Adaptiv yadro (yuqorida batafsil): `role_detection.py`, `onboarding.service.ts`,
  `/onboarding` sahifasi, adaptiv dashboard, 3 tilda yangi i18n kalitlari
- `halal_filter.py`: `classify(..., profession=...)` — kasb konteksti; blocklist kengaytirildi
- `streaming.py` / `main.py`: `profession` va `conversation_history` parametrlari
- `conversations`: `POST /:id/messages/bulk` — chat endi suhbatni DB'ga saqlaydi
- `api-client.ts`: xato javob payload'i saqlanadi (`err.payload`, `err.status`)
- Sign-up → `/onboarding` ga yo'naltiradi (sign-in → dashboard, avvalgidek)
- `prisma/migrations/..._init/migration.sql` tuzatildi (`DEFAULT {}` → `DEFAULT '{}'` —
  SQLite'da yangi o'rnatish endi ishlaydi); joriy DB `prisma db push` bilan yangilandi
- Eslatma: SQLite'da `prisma migrate dev` o'rniga `prisma db push` ishlating
