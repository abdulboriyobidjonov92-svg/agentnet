# ADR-021 — Deploy topologiyasi: frontend Vercel'da, backend Render'da

**Sana:** 2026-08-06 · **Holat:** ACCEPTED
**Ta'sir qiladi:** ADR-019 (Deployment Platform) — **qisman SUPERSEDED**
(faqat "Vercel + Render aralashmasi rad etiladi" qismi; qolgan qarorlar kuchda).
**Bog'liq:** ADR-004 (AI Engine — private service), SEC-10.

## Problem

ADR-019 barcha servislarni Render'da saqlashni tanlagan va "Vercel + Railway
aralashmasi"ni rad etgan edi (sabab: ikki panel, ikki hisob-faktura).

SEC-10 bilan engine Render **private service**ga o'tdi. Shu paytgacha Next.js
BFF (`/api/chat/stream`) engine'ga **to'g'ridan-to'g'ri** murojaat qilardi.
Xususiy tarmoq Render tashqarisidan ko'rinmaydi, ya'ni bu ikki qaror birga
turolmaydi: yo frontend Render'da qoladi, yo BFF engine'ga bormaydi.

Bundan tashqari ADR-019'ning o'zi bir ichki ziddiyatni ko'tarib yurardi:
Contract A3 serverless funksiyalarni "uzoq SSE" sababli rad etadi, lekin
chat SSE orkestratsiyasi (charge → consume → engine → refund) aynan Next.js
route'ida — ya'ni Vercel'da serverless funksiyada — yashaydi.

## Decision

**Frontend (Next.js UI + BFF) — Vercel. Backend — to'liq Render:**
NestJS API (ommaviy), Python agent-engine (`pserv`, xususiy), PostgreSQL,
Redis (Phase 6) va kelajakdagi barcha background worker'lar.

Buni mumkin qiladigan yagona kod o'zgarishi: **frontend endi engine'ni
umuman bilmaydi**. Chat oqimi `POST /api/agents/stream` orqali API'dan
o'tadi:

```
brauzer → Vercel BFF → Render API → Render engine (xususiy)
```

Natijada frontend **deploy-portativ** bo'ladi: unga faqat
`NEXT_PUBLIC_API_URL` va `INTERNAL_API_TOKEN` kerak — ayni shu env
to'plami bilan u Vercel'da ham, Render'da ham bir xil ishlaydi.

Pul va kvota mantiqi (charge → consume → refund zanjiri) **BFF'da qoladi** —
bu ADR uni ko'chirmaydi (pastdagi "Long-term impact"ga qarang).

## Alternatives

**(a) Frontend ham Render'da qolsin (ADR-019 asl holicha).**
**(b) Engine ommaviy qolsin, faqat ichki token bilan himoyalansin.**
**(c) Frontend Vercel'da, lekin BFF engine'ga ommaviy URL orqali borsin.**
**(d) Chat orkestratsiyasi (charge/consume/refund) ham API'ga ko'chirilsin.**

## Why rejected

- **(a)** Ishlaydi, lekin Next.js uchun Render `node` runtime'i Vercel'ning
  edge/CDN, ISR va build-keshidan sezilarli past. Frontend — mahsulotning
  birinchi taassuroti (LCP, 3D landing); bu yerda platforma tanlash real
  qiymat beradi. ADR-019'ning "ikki panel" argumenti kuchini yo'qotdi:
  frontend endi **bitta** env'ga bog'liq, ya'ni operatsion yuk minimal.
- **(b)** Konstitutsiya qoidasi #5 ("Engine hech qachon ommaviy internetga
  chiqarilmaydi") va ADR-004'ni bevosita buzadi. Token sizsa — cheksiz
  Anthropic sarfi va halal/billing/kvota qatlamlarini chetlab o'tish.
- **(c)** (b) ning boshqacha aytilgani — engine ommaviy qolishi kerak bo'lardi.
- **(d)** To'g'ri yo'nalish, lekin **bu ADR doirasidan tashqari**: bu pul
  yo'lini (Konstitutsiya §Pul, 15–21-qoidalar) qayta yozish demak va o'z
  ADR'i, o'z test qatlami bilan kelishi kerak. SEC-10 uni talab qilmaydi —
  bu yerda faqat bitta tarmoq-hop qo'shiladi, mantiq bir zarra ham
  o'zgarmaydi.

## Long-term impact

**Ijobiy:**
- Engine tarmoq darajasida yopiq bo'lib qoladi (ADR-004 to'liq bajariladi).
- Frontend deploy-portativ: platforma almashtirish endi arzon qaror.
- `user_id` engine'ga endi **imzolangan tokendan** (API tomonda) ketadi,
  body'dan emas — spoofing yuzasi yo'qoldi.
- Backend'ning barcha bo'laklari (API, engine, DB, Redis, worker'lar) bitta
  xususiy tarmoqda — Phase 6 (Redis, BullMQ, browser-worker) uchun tayyor zamin.

**Narxi / qarzi:**
- Bitta qo'shimcha tarmoq-hop (BFF → API → engine). SSE uchun bu
  o'tkazuvchanlikka ta'sir qilmaydi; birinchi baytga ~1 RTT qo'shiladi.
- **Ochiq qarz:** chat orkestratsiyasi hamon Vercel serverless funksiyasida
  ishlaydi. Vercel funksiya davomiyligi limitiga urilsa, oqim o'rtasida
  uzilish bo'ladi — bunda mavjud `stream_failed` refund yo'li ishga tushadi
  (pul yo'qolmaydi), lekin foydalanuvchi javobni to'liq olmaydi. Uzoq
  javoblar uchun (d) varianti alohida ADR bilan qayta ko'riladi.
- Vercel'da `INTERNAL_API_TOKEN` qo'lda sozlanadi (Render env-guruhi u yerda
  ishlamaydi) — sir ikki panelda yashaydi.
