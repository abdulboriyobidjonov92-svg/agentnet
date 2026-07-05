# AgentNet (Baraka AI) — Texnik Strategiya va MVP Reja

*Sana: 2026-06-29*

---

## 1. Loyiha haqida qisqa xulosa

**AgentNet (Baraka AI)** — oddiy foydalanuvchidan tortib do'kon egasi, biznes va davlat tashkilotlarigacha — hamma uchun shaxsiy va biznes hayotni boshqaruvchi, **halol-filtrlangan, no-code multi-agent AI platforma**.

Foydalanuvchi chat yoki vizual (drag-and-drop) builder orqali o'z AI agentini yaratadi: unga xotira, vositalar (tool) va integratsiyalar (bank, kamera, email, messenger) ulanadi. Agentlar bir-biri bilan muloqot qiladi (multi-agent orchestration), natijani esa **Halal Filter** qatlami tekshiradi — qimor, riba, fitna, nojo'ya kontentni avtomatik bloklaydi.

**Asosiy differensiatsiya (raqobatdan farqi):**

1. *Halal-first* — boshqa hech bir global no-code agent platformasi (n8n, Flowise, Dify, CrewAI Studio) dinий/axloqiy filtrni yadro qatlami sifatida taklif qilmaydi. Bu O'rta Osiyo, Yaqin Sharq va musulmon foydalanuvchilar uchun ishonch va tabaqalanish nuqtasi.
2. *Bitta super-app o'rniga — agent ekotizimi*: foydalanuvchi alohida ilovalar o'rniga bir joydan barcha hayotiy sohalarini (sog'liq, namoz, moliya, biznes) boshqaradi.
3. *Marketplace + royalty* — agent yaratuvchilar daromad oladi, bu platformani o'z-o'zini kengaytiruvchi ekotizimga aylantiradi.
4. *Mahalliy kontekst* — O'zbekiston/MDH bozori uchun Payme/Click/Uzcard/Humo integratsiyasi, O'zbekiston shaxsiy ma'lumotlar qonunchiligiga moslashuv (2026-yil mart oyidagi yangilanishlar asosida — pastda 6-bo'limda).

**MVP maqsadi (8 hafta):** ishonchli auth+2FA, 3-4 shaxsiy agent, 2-3 biznes agent (jumladan kamera monitoring asosiy versiyasi), halal filter ishlab turgan holatda, kamida bitta to'lov tizimi integratsiyasi va minimal marketplace bilan yopiq beta-ishga tushirish.

**Uzoq muddatli maqsad:** millionlab foydalanuvchiga chiqadigan, gorizontal masshtablanadigan (multi-tenant, mikroservis asosli) arxitektura — lekin MVP босqichида ortiqcha murakkablashtirmasdan, monolit-yaqin tarzda tez ishga tushirish.

---

## 2. To'liq texnik stack tavsiyasi va sabablari

### 2.1 Frontend

| Texnologiya | Tanlov sababi |
|---|---|
| **Next.js 15+ (App Router) + React 19 + TypeScript** | 2026-yilda eng katta ekotizim, server components orqali tezlik, Vercel bilan native integratsiya, SEO (marketplace sahifalari uchun muhim). |
| **Tailwind CSS + shadcn/ui** | Tez, izchil dizayn-tizimi; no-code builder UI uchun komponentlar tayyor. |
| **React Flow** | Vizual agent-builder canvas (node-based workflow) — agent va toollarni "drag-and-drop" bog'lash uchun standart kutubxona. |
| **Zustand + TanStack Query** | Yengil state management + server-state keshlash (Redux'dan ko'ra soddaroq, kichik jamoa uchun mos). |
| **Expo (React Native)** | Mobil ilova — bitta kod bazasi iOS/Android uchun, push-bildirishnoma (dori eslatmasi, namoz vaqti) kritik UX talabi. |

### 2.2 Backend — gibrid arxitektura

AI-og'ir ishlar (agent runtime, computer vision, ML) va odatiy SaaS ishlari (auth, billing, CRUD) **ataylab ikkita xizmatga ajratiladi** — bu 2026-yilda AI-SaaS startaplarda standart yondashuv, chunki Python AI ekotizimi (LangGraph, Ultralytics, transformers) TypeScript'dan ancha boy, lekin SaaS-CRUD uchun NestJS tezroq va xavfsizroq.

| Qatlam | Texnologiya | Sabab |
|---|---|---|
| **Core SaaS API** | **NestJS (Node.js + TypeScript)** | Modulli, dependency-injection, RBAC/guard'lar tayyor, katta jamoa uchun standartlashtirilgan struktura. Auth, billing, marketplace, foydalanuvchi/agent CRUD shu yerda. |
| **Agent Orchestration Service** | **Python + FastAPI + LangGraph** | 2026-yilda production multi-agent tizimlar uchun yetakchi: graf-asoslangan holat boshqarish, audit/rollback nuqtalari, eng katta enterprise qabul qilinishi (LangGraph CrewAI'ni GitHub yulduzlarida 2026 boshida o'tib ketdi). Halal-filter kabi *audit talab qiladigan* oqimlar uchun aynan shu xususiyat muhim. |
| **LLM provider** | **Claude (Sonnet 4.6) — asosiy**, GPT-4.1 / Gemini 2.5 — fallback | Claude: kuchli ko'p tilli (o'zbek/rus/arab/ingliz), ishonchli tool-use, agentic vazifalarda yuqori sifat, "Claude Agent SDK" orqali tayyor agent-runtime primitivlari. Fallback — narx optimallashtirish va uzilish holatlari uchun. |
| **Computer Vision microservice** | **Python + Ultralytics YOLOv11 + ByteTrack** | Kamera/o'g'ri aniqlash uchun. Alohida xizmat — GPU resurslarini izolyatsiya qilish va asosiy API'ni bloklamaslik uchun. |

### 2.3 Ma'lumotlar bazasi va xotira

| Texnologiya | Sabab |
|---|---|
| **PostgreSQL (Neon yoki Supabase) + `pgvector`** | Relyatsion + vektor xotirani bitta bazada birlashtiradi — MVP uchun infra murakkabligini kamaytiradi. Agent "uzoq muddatli xotirasi" embedding sifatida shu yerda saqlanadi. Keyinchalik (millionlab foydalanuvchi bosqichida) Qdrant/Pinecone'ga ajratish mumkin. |
| **Redis (Upstash)** | Sessiya keshi, rate-limiting, BullMQ orqali job queue (agent ijrosi, webhook, eslatmalar). |
| **Cloudflare R2 / S3** | Fayllar (ovqat fotosi, kamera videoklipi, audit eksport). R2 — egress narxi yo'qligi sababli video-og'ir kamera funksiyasi uchun arzonroq. |

### 2.4 Autentifikatsiya

| Texnologiya | Sabab |
|---|---|
| **Clerk** | TOTP/SMS 2FA, ijtimoiy login, multi-tenant "organizations" (biznes hisoblari uchun aynan kerak) — 10 daqiqada production-ready, 2026-yilda Next.js ekotizimida DX bo'yicha yetakchi. MVP tezligi uchun tavsiya etiladi. |
| **Muqobil (xarajat past bo'lishi kerak bo'lsa):** Supabase Auth + Postgres RLS | Agar Postgres'ni Supabase orqali tutsangiz — bepul/arzon, RLS orqali ma'lumotlar xavfsizligi baza darajasida ta'minlanadi. Kelajakda ko'chish yo'li ochiq. |

### 2.5 Agent ijro xavfsizligi (sandbox)

| Texnologiya | Sabab |
|---|---|
| **E2B Code Interpreter yoki Daytona (Firecracker microVM)** | Foydalanuvchi yaratgan har qanday agent logikasi/kod-bajarish vositasi izolyatsiyalangan, vaqtincha microVM ichida ishlaydi — fayl tizimi/tarmoqqa to'g'ridan-to'g'ri kirishsiz, faqat ruxsat etilgan tool API'lar orqali. |

### 2.6 Integratsiyalar

| Soha | Texnologiya/API |
|---|---|
| Email | Gmail API, Microsoft Graph (Outlook) |
| Bank/to'lov (O'zbekiston) | Payme Business API, Click Merchant API, Uzum Bank API — barchasi UZCARD/HUMO'ni qo'llaydi |
| Bank/to'lov (xalqaro kengayish) | Plaid / Salt Edge / TrueLayer (Open Banking) |
| Kamera | RTSP + ONVIF (deyarli barcha zamonaviy IP-kameralar qo'llaydi), `python-onvif-zeep`, FFmpeg/go2rtc stream uchun |
| Messenger | WhatsApp Business Cloud API, Telegram Bot API |
| Kalendar | Google Calendar API, Microsoft Graph Calendar |
| Marketplace to'lovi | Stripe Connect (xalqaro) + Payme/Click split-payment (mahalliy) |

### 2.7 Infra, DevOps va kuzatuv

| Texnologiya | Sabab |
|---|---|
| **Vercel** (frontend) + **Railway/Fly.io** → keyin **AWS ECS/Fargate** (backend, masshtablanganda) | Boshlanishda tez deploy, keyin enterprise darajaga ko'chish yo'li ochiq. |
| **Docker + Terraform** | Reproducible infra, IaC. |
| **GitHub Actions** | CI/CD. |
| **Sentry + OpenTelemetry + Grafana/Loki** | Xato kuzatuvi, tracing, log agregatsiyasi. |
| **Cloudflare (WAF + CDN + Rate limiting)** | Hujumlardan himoya, edge-darajada filtrlash. |

---

## 3. Tizim arxitekturasi (tekst diagrammasi)

```
                              ┌──────────────────────────────────┐
                              │           FOYDALANUVCHI          │
                              │  Web (Next.js) | Mobil (Expo)    │
                              │  Telegram Bot  | WhatsApp Bot     │
                              └────────────────┬───────────────────┘
                                               │ HTTPS / WSS
                              ┌────────────────▼───────────────────┐
                              │   EDGE / API GATEWAY (Cloudflare)  │
                              │   WAF • Rate-limit • DDoS himoya   │
                              └────────────────┬───────────────────┘
                                               │
          ┌────────────────────────────────────┼─────────────────────────────────────┐
          ▼                                    ▼                                     ▼
┌──────────────────────┐        ┌──────────────────────────────┐      ┌──────────────────────────┐
│   CORE SAAS API      │        │   AGENT ORCHESTRATION        │      │   HALAL FILTER LAYER     │
│   (NestJS, TS)       │◄──────►│   (FastAPI + LangGraph)      │◄────►│   (har bir kirish/       │
│  • Auth/2FA (Clerk)  │        │  • Agent runtime + xotira    │      │   chiqishni tekshiradi)  │
│  • Billing/Royalty   │        │  • Tool-calling registry     │      │  • Keyword blocklist     │
│  • Marketplace       │        │  • Multi-agent router        │      │  • Semantic classifier   │
│  • RBAC / Audit log  │        │  • Sandbox executor (E2B)    │      │  • LLM-asoslangan tekshir│
└──────────┬────────────┘        └──────────────┬────────────────┘      └────────────┬─────────────┘
           │                                    │                                     │
           │                     ┌──────────────▼───────────────┐                     │
           │                     │      LLM PROVIDER QATLAMI     │◄────────────────────┘
           │                     │  Claude Sonnet (asosiy)       │
           │                     │  GPT-4.1 / Gemini (fallback)  │
           │                     └───────────────────────────────┘
           │
┌──────────▼─────────────────────────────────────────────────────────────────────────┐
│                              INTEGRATSIYA QATLAMI                                   │
│  Gmail/Outlook │ Payme/Click/Uzum/Plaid │ RTSP/ONVIF kamera + YOLO CV-xizmati       │
│  WhatsApp/Telegram │ Google Calendar │ Stripe Connect                              │
└──────────┬─────────────────────────────────────────────────────────────────────────┘
           │
┌──────────▼─────────────────────────────────────────────────────────────────────────┐
│                               MA'LUMOTLAR QATLAMI                                   │
│  PostgreSQL + pgvector (asosiy + xotira) │ Redis (kesh/queue) │ R2/S3 (fayl/video)  │
│  Audit Log (immutable, hash-chained) │ KMS (shifrlash kalitlari)                    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Oqim misoli (do'kon kamerasi → o'g'rilik ogohlantiruvi):**
RTSP kamera → CV-xizmat (YOLO+ByteTrack, harakat ketma-ketligini kuzatadi) → shubhali hodisa → Claude Vision orqali ikkinchi tekshiruv (false-positive kamaytirish) → Halal Filter (bu yerda kontent filtri emas, balki **maxfiylik filtri** — yuz tanish ma'lumoti faqat ruxsat etilgan holatda saqlanadi) → Agent Orchestration → Telegram/WhatsApp orqali do'kon egasiga bildirishnoma + Audit Log yozuvi.

---

## 4. MVP — Hafta-ma-hafta roadmap (8 hafta)

**Hafta 1 — Poydevor**
Repo/monorepo (Turborepo) sozlash, infra (Vercel + Railway, Neon Postgres, Upstash Redis), Clerk orqali auth+2FA, asosiy DB sxemasi (users, orgs, agents, conversations, audit_log), CI/CD, dizayn-tizim (shadcn) skeletoni.

**Hafta 2 — Chat va agent CRUD**
Chat UI (stream javoblar), Agent CRUD API (NestJS), LangGraph'da bitta-agent ijro tsikli (FastAPI xizmat), Claude API integratsiyasi, suhbat tarixi Postgres'da, asosiy no-code forma (agent nomi, system prompt, tool-toggle).

**Hafta 3 — Halal Filter v1 + birinchi shaxsiy agentlar**
Halal Filter middleware (keyword blocklist + LLM-klassifikator) barcha agent kirish/chiqishiga ulanadi. **Namoz va Qur'on agenti** (Aladhan API — namoz vaqtlari, Qur'on matni/audio API). **Ruhiy salomatlik agenti** (xavfsizlik-birinchi: tibbiy tashxis qo'ymaydi, inqiroz holatida resurslarga yo'naltiradi).

**Hafta 4 — Sog'liq va sport agentlari**
Simptom-trёj agenti (faqat ma'lumot beradi, tashxis qo'ymaydi, shifokorga murojaat tavsiya qiladi), ovqat fotosidan kaloriya hisoblash (Claude Vision + ovqat-baza), mashq rejasi generatori, dori eslatmasi (cron + Telegram push).

**Hafta 5 — Biznes agentlari v1**
Inventarizatsiya agenti (Excel/CSV import, qoldiq kuzatuv), savdo/moliya/buxgalteriya agenti (tranzaksiyalarni avto-kategoriyalash + riba-belgilash), email avtomatlashtirish agenti (Gmail API — javob qoralamasi, saralash).

**Hafta 6 — Kamera monitoring MVP + multi-agent**
RTSP/ONVIF stream qabul qilish xizmati, YOLOv11 asosida odam/harakat aniqlash, oddiy anomaliya heuristikasi + Claude Vision tasdiqlash, Telegram orqali ogohlantirish. Multi-agent router (bir nechta agent bir-biriga vazifa topshiradi). pgvector orqali uzoq muddatli xotira.

**Hafta 7 — To'liq integratsiyalar**
WhatsApp/Telegram bot gateway, Google Calendar, Payme/Click sandbox (test) integratsiyasi + halal-belgilash, oilaviy agentlar (byudjet, bolalar jadvali).

**Hafta 8 — Marketplace MVP + xavfsizlik + beta**
Agent marketplace (joylash/o'rnatish/royalty hisob-kitobi), Stripe Connect/Payme split-payment, xavfsizlik auditi (pentest checklist, rate-limit, sirlarni aylantirish), yuklama testi, **yopiq beta (50–100 foydalanuvchi)** ishga tushirish + feedback tsikli.

---

## 5. Muhim kod misollari

Quyidagi kodlar **ishlatishga tayyor skeletonlar** sifatida loyiha papkasiga alohida fayllar qilib joylashtirildi (`code/` papkasi):

| Fayl | Vazifasi |
|---|---|
| `code/auth/auth.service.ts` | NestJS + Clerk asosida auth, 2FA majburlash, RBAC guard, audit-log |
| `code/agents/agent_engine.py` | LangGraph asosida no-code agent compile va ijro qilish motori |
| `code/halal-filter/halal_filter.py` | Ko'p qatlamli Halal Filter (keyword → semantik → LLM klassifikator) |
| `code/integrations/camera_service.py` | RTSP/ONVIF + YOLO + Claude Vision orqali o'g'rilik aniqlash |
| `code/integrations/bank_connector.ts` | Payme/Click/Plaid uchun adapter-pattern bank integratsiyasi |

Har bir fayl batafsil izohlar bilan yozilgan — quyida har birining qisqacha tushuntirishi:

**`auth.service.ts`** — Clerk webhook orqali foydalanuvchini sinxronlashtiradi, biznes-hisoblar uchun 2FA'ni **majburiy** qiladi, har bir muhim amalni (login, agent yaratish, integratsiya ulash) audit-log'ga yozadi.

**`agent_engine.py`** — no-code builder'dan kelgan JSON-graf (`AgentDefinition`) ni LangGraph `StateGraph`'ga compile qiladi, tool-registry orqali ruxsat etilgan vositalarni bog'laydi, pgvector orqali xotiraga ulanadi.

**`halal_filter.py`** — uch bosqichli filtr: (1) tezkor regex/lug'at-asoslangan bloklash, (2) embedding-asoslangan semantik o'xshashlik (qimor/riba/fitna vektorlariga yaqinlik), (3) past ishonch holatlarida Claude orqali qat'iy JSON-formatda yakuniy klassifikatsiya. Har bir qaror audit-log'ga sababi bilan yoziladi.

**`camera_service.py`** — ONVIF orqali kamerani aniqlaydi, RTSP oqimini YOLOv11+ByteTrack bilan tahlil qiladi, vaqt-ketma-ketlik (temporal) oynasi orqali shubhali harakatni belgilaydi, Claude Vision bilan ikkinchi tekshiruv qiladi (yolg'on signal kamaytirish), faqat tasdiqlangan holatda ogohlantirish yuboradi.

**`bank_connector.ts`** — bitta umumiy `BankConnector` interfeysi orqali Payme, Click va xalqaro Plaid adapterlarini birlashtiradi; har bir tranzaksiyani halal-moliya agenti uchun riba/foiz belgisi bilan teglaydi.

*(Fayllarning to'liq mazmuni ushbu hujjat bilan birga `code/` papkasida.)*

---

## 6. Xavfsizlik va maxfiylik tizimi

### 6.1 Autentifikatsiya va ruxsatlar
- Clerk orqali TOTP/SMS 2FA — **biznes va admin hisoblar uchun majburiy**, shaxsiy hisoblar uchun tavsiya etiladi.
- Qisqa muddatli JWT + rotatsiyalanadigan refresh token.
- RBAC: `owner / admin / member / viewer` + agent-darajasidagi ruxsatlar (qaysi agent qaysi integratsiyaga kira oladi).

### 6.2 Shifrlash
- TLS 1.3 — barcha trafik.
- Ma'lumotlar bazasi va fayl xotirasi — provider KMS (AWS KMS/GCP KMS) orqali at-rest shifrlash.
- Maxsus nozik ma'lumotlar (bank tokeni, sog'liq ma'lumoti, yuz-tanish vektori) — **field-level envelope encryption**, alohida kalit bilan.

### 6.3 Agent sandboxing
- Har qanday foydalanuvchi-yaratgan logika yoki kod-bajaruvchi tool — E2B/Daytona microVM ichida, tarmoq/fayl tizimiga to'g'ridan-to'g'ri kirishsiz, faqat ruxsat etilgan tool-API orqali, CPU/xotira/vaqt kvotasi bilan.

### 6.4 Audit log
- Har bir agent amali, integratsiya chaqirig'i (bank o'qish, email yuborish, kamera ogohlantiruvi), va Halal Filter qarori — **o'zgartirib bo'lmaydigan (append-only, hash-chained)** jurnalga yoziladi.
- Foydalanuvchi o'ziga tegishli audit-yozuvlarni ko'rishi va eksport qilishi mumkin ("nega bloklandi" shaffofligi).

### 6.5 Tarmoq himoyasi
- Cloudflare WAF + DDoS himoyasi edge darajasida.
- Upstash Redis orqali sliding-window rate-limiting (har foydalanuvchi/IP).
- Sirlar (API kalitlar) — Doppler/Vault, kodga hech qachon yozilmaydi, choraklik rotatsiya.

### 6.6 Ma'lumotlar mahalliylashtirilishi (O'zbekiston, 2026-yil holatiga ko'ra)

2026-yil 27-martda O'zbekistonning "Shaxsiy ma'lumotlar to'g'risida"gi qonuniga kiritilgan o'zgartirishlar kuchga kirdi: endi barcha serverlar O'zbekistonda joylashishi **shart emas** — chet elda saqlash/qayta ishlash xavfsizlik talablariga rioya qilingan, xalqaro standartlarga mos va davlat organlari nazorati ta'minlangan holda ruxsat etiladi. Biroq **biometrik, genetik va telekom-bog'liq ma'lumotlar** hamon faqat mahalliy serverlarda saqlanishi shart.

**Amaliy ta'siri AgentNet uchun:**
- Do'kon-kamerasi agentidagi **yuz-tanish/biometrik vektorlar** — O'zbekiston hududidagi serverda saqlanishi kerak (masalan, mahalliy data-center bilan hamkorlik yoki Tier-2 mintaqaviy provider).
- Boshqa foydalanuvchi ma'lumotlari (chat, moliya, sog'liq matnlari) — xalqaro bulutda (AWS/GCP) saqlash mumkin, lekin shartlarga (xavfsizlik standarti, davlat nazorati imkoniyati) rioya qilish kerak.
- Bu — yuridik maslahatchi bilan tasdiqlanishi shart bo'lgan band; ushbu hujjat huquqiy xulosa emas.

---

## 7. Halal filter uchun prompt misollari

Quyidagi promptlar `halal_filter.py` ichidagi LLM-klassifikator bosqichida ishlatiladi (Claude'ga yuboriladigan system prompt):

```
SYSTEM PROMPT — Halal Content Classifier

Sen AgentNet platformasidagi Halal Filter tizimisan. Vazifang —
foydalanuvchi xabari yoki agent javobini Islomiy me'yorlar nuqtai
nazaridan tasniflash, FATWO CHIQARISH EMAS.

Tekshiruv toifalari:
1. QIMOR (gambling) — bahs, lotereya, kazino, spekulyativ "garov" taklifi
2. RIBO (interest/usury) — foiz asosidagi kredit/qarz tavsiyasi yoki targ'iboti
3. NOJO'YA_KONTENT — explicit/zo'ravon/odob doirasidan tashqari material
4. FITNA — diniy/millatlar/guruhlar orasida nifoq qo'zg'ovchi kontent
5. XAVFSIZ — yuqoridagilarning hech biriga to'g'ri kelmaydi

Qoidalar:
- Faqat YUQORIDA sanab o'tilgan aniq belgilar asosida bahola, shubhali
  bo'lsa "NOANIQ" deb belgila va inson-tekshiruviga yubor (taxmin qilma).
- Diniy hukm chiqarma — faqat tasniflash, sabab-izoh ber.
- Javobni FAQAT quyidagi JSON formatda qaytar:

{
  "category": "QIMOR|RIBO|NOJOYA_KONTENT|FITNA|XAVFSIZ|NOANIQ",
  "confidence": 0.0-1.0,
  "reasoning": "qisqa, aniq sabab (o'zbek tilida)",
  "action": "BLOCK|ALLOW|HUMAN_REVIEW"
}
```

```
FOYDALANUVCHI PROMPTI NAMUNASI (kiritiladigan kontent bilan birga):

Quyidagi matnni tasniflang:
---
"{{user_or_agent_text}}"
---
Kontekst: bu matn "{{agent_name}}" agenti orqali "{{user_segment}}"
foydalanuvchisiga {{direction: kiruvchi|chiquvchi}} sifatida ishlov
berilmoqda.
```

```
MOLIYA AGENTI UCHUN MAXSUS PROMPT (riba-belgilash):

Sen moliya/buxgalteriya agentisan. Har bir tranzaksiya tasvirini
tahlil qilib, quyidagilarni belgila:
- "interest_flag": true/false — agar tranzaksiya tasvirida foiz,
  kredit foizi, kechiktirilgan to'lov jarimasi kabi riba belgilari
  bo'lsa.
- "category": xarajat toifasi (oziq-ovqat, kommunal, va h.k.)
- Agar interest_flag=true bo'lsa, foydalanuvchiga halol muqobil
  (masalan, murobaha/ijara asosidagi moliyalashtirish) haqida
  ma'lumot taklif qil — lekin moliyaviy maslahat sifatida emas,
  faqat ma'lumot sifatida, va "men moliyaviy maslahatchi emasman"
  ogohlantirishi bilan.
```

**Eslatma:** Halal Filter — texnik vosita, rasmiy diniy fatvo manbai emas. Production'ga chiqishdan oldin **malakali Shariah kengashi** bilan toifalar ro'yxati va chegara holatlari tasdiqlanishi zarur (xuddi Islomiy fintech kompaniyalari AAOIFI standartlariga moslashtirgani kabi).

---

## 8. Keyingi qadamlar

1. **Texnik:** Yuqoridagi `code/` papkasidagi 5 skeleton faylni asosida real repo (monorepo, Turborepo) tashkil qilish; Hafta-1 vazifalarini boshlash.
2. **Huquqiy:** O'zbekiston shaxsiy ma'lumotlar qonuni (2026 yangilanishi) va Markaziy bank to'lov-tizim talablari bo'yicha huquqshunos bilan maslahatlashish — ayniqsa biometrik (kamera) ma'lumotlar saqlash joyi bo'yicha.
3. **Diniy:** Halal Filter toifalari va chegara-holatlarini tasdiqlash uchun Shariah maslahatchi/kengash bilan ishlash.
4. **Bank hamkorligi:** Payme Business va Click Merchant sandbox kalitlarini olish (ariza — ikkalasi ham tezkor onboarding taklif qiladi).
5. **Pilot mijozlar:** 5–10 ta kichik do'kon bilan kamera-monitoring agentini pilot sifatida sinash (real ONVIF kamera muhitida aniqlik/yolg'on-signal ko'rsatkichini o'lchash).
6. **Jamoa:** MVP uchun minimal jamoa — 1 full-stack (Next.js/NestJS), 1 AI/Python (LangGraph/CV), 1 dizayner/no-code UX — 8 haftalik rejani real bajarish uchun.
7. **Moliyalashtirish/metrika:** Beta tugagach — agent yaratish/kun, agent ijro muvaffaqiyat foizi, Halal Filter false-positive darajasi, retention — keyingi bosqich uchun asosiy metrikalar sifatida kuzatish.

---

### Manbalar (texnologik tanlovlar uchun, 2026-yil holatiga ko'ra qidiruv natijalari)

- [The best AI agent frameworks in 2026 — LangChain](https://www.langchain.com/resources/ai-agent-frameworks)
- [Best Multi-Agent Frameworks in 2026](https://gurusup.com/blog/best-multi-agent-frameworks-2026)
- [Agentic Orchestration: LangGraph vs CrewAI vs Mastra](https://www.digitalapplied.com/blog/agentic-orchestration-frameworks-langgraph-vs-crewai)
- [Better Auth vs Clerk vs NextAuth vs Supabase Auth (2026)](https://makerkit.dev/blog/tutorials/better-auth-vs-clerk)
- [Retail Shrinkage Is a $132 Billion Problem — AI Video Analytics](https://intellisee.com/retail-shrinkage-is-a-132-billion-problem-heres-how-ai-video-analytics-is-finally-solving-it/)
- [Accepting Payments in Uzbekistan: PSPs, Compliance & Fees](https://payatlas.com/countries/uzbekistan-uz)
- [Payme business](https://business.payme.uz/en) / [Humo](https://humocard.uz/en/) / [PayTechUz (open-source)](https://github.com/PayTechUz)
- [How to Build a Shariah-Compliant Fintech Platform in 2026](https://www.markupdesigns.com/blog/shariah-compliant-fintech-platform-development/)
- [Uzbekistan dismantles strict data localization regime — Dentons](https://www.dentons.com/en/insights/articles/2026/march/31/uzbekistan-dismantles-strict-data-localization-regime)
- [Uzbekistan amends personal data law — Kun.uz](https://kun.uz/en/news/2026/03/27/uzbekistan-amends-personal-data-law-to-facilitate-global-payment-systems)
