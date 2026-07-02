# AgentNet — Prototip holati ✅

**Sana:** 2026-07-02 (Part 1 yakunlandi)
**Holat:** Adaptiv yadro + **BESHTA FLAGMAN IMKONIYAT** (Life Twin, Autonomous
Goals, Agent Fusion, Ethical Decision Engine, Knowledge Sync) + **Super Mode**.
Uchala servis ishga tushirilgan va E2E tekshirilgan.

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
