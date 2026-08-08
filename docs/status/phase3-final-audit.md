# Phase 3 (Data Access Contract) — yakuniy audit

**Sana:** 2026-08-08 · **Metod:** repozitoriyning O'ZI tekshirildi (oldingi
hisobotlarga ishonilmadi) — sxema, migratsiyalar, kod, jonli dev bazasi.
**Manba:** `docs/ENGINEERING_CONTRACT.md` §3 (Phase 3) va §2 (A12–A18).

> Bu hujjat HOLATNI qayd etadi. Tarixiy yozuvlar (ADR, runbook, commit
> xabarlari) o'zgartirilmagan.

## Contract §3 Phase 3 bandlari

| # | Contract bandi | Holat | Dalil |
|---|---|:---:|---|
| 1 | Kursorli pagination **shartnomasi** (A18) | ✅ | `common/pagination/` (`PageQueryDto`, `paginate()`), 18 test; `skip:` butun API'da 0 marta |
| 2 | Shartnomani **barcha ro'yxatlarga qo'llash** | ⚠️ **QISMAN** | Faqat 2 endpoint (`/agents`, `/conversations`) + `/conversations/:id/messages`. Pastga qarang |
| 3 | Prisma enum'lar (A14) | ✅ | 9 enum, 10 ustun; `20260807120000` |
| 4 | Yetishmayotgan kompozit indekslar (Rule #25) | ✅ | 3 indeks, EXPLAIN bilan tasdiqlangan; `20260807130000` |
| 5 | Audit lock per-actor (A17/ADR-008) | ✅ | kanonik hash + `verifyChain()`; `20260807140000` |
| 6 | `BigInt` pul migratsiyasi (A13) | ✅ | 11 ustun; `20260807150000` |
| 7 | `Message` jadvali (A12) | ✅ | jadval + backfill + cutover + legacy DROP; `20260808100000`, `20260808120000` |
| 8 | `deletedAt` olib tashlash (A15) | ✅ | 0 chaqiruv-nuqta, ustun bo'sh edi; `20260808130000` |

## ⚠️ Ochiq band — pagination qamrovi (Contract §3 va Sprint 4)

Contract Sprint 4: *"kursorli pagination shartnomasi + **12 ta og'ir
ro'yxatga qo'llash**"*. Bugun shartnoma **qurilgan va isbotlangan**, lekin
faqat 3 joyda qo'llangan.

Qolgan sahifalanmagan `findMany` (o'sib boradigan, foydalanuvchi-ko'rinadigan
ro'yxatlar — ustuvorlik tartibida):

| Endpoint / service | Model | Nega muhim |
|---|---|---|
| `billing.getBalance` | `CreditLedger` | qattiq `take: 30` — balans tarixi kesilgan |
| `automation.service` | `AutomationRun` | brauzer-run tarixi cheksiz o'sadi |
| `device-control` | `DeviceActionLog` | xavfsizlik jurnali — eng tez o'sadigan jadval |
| `call-recording.service` | `CallRecording` | media metama'lumoti |
| `marketplace` | `Agent`, `AgentReview` | katalog + sharhlar |
| `feedback.service` | `Feedback` | admin ro'yxati (`take: 500`) |
| `connectors`, `goals`, `govtech`, `agentos`, `automation.sessions` | turli | vertikal ro'yxatlar |

**Nega bu commitda BAJARILMADI:** ~10 servis + ularning frontend
iste'molchilarini o'zgartirish — alohida ijro birligi. Uni legacy-ustun
yopilishi bilan bitta commitga qo'shish "bog'liq bo'lmagan ishni aralashtirish"
bo'lardi. **Jimgina kechiktirilmadi** — shu yerda ochiq qayd etildi va
keyingi ish birligiga kiritilishi kerak.

**Bloklovchi emas:** shartnoma va uning primitivlari tayyor; qolgani —
mexanik qo'llash. Admin panel (P4) o'z ro'yxatlarini boshidan sahifalangan
holda quradi.

## Ma'lumot yaxlitligi — jonli dev bazasi

| Tekshiruv | Natija |
|---|---|
| Suhbatlar / xabarlar | 2 / 6 |
| Yetim xabar | 0 |
| Dublikat xabar id | 0 |
| `Message` FK | `ON DELETE CASCADE` ✓ |
| Indekslar | `Message_conversationId_createdAt_idx`, `Message_pkey` |
| Legacy `Conversation.messages` | tashlangan ✓ |
| `User.deletedAt` | tashlangan ✓ |
| `migrate status` | toza |

## Migratsiya paytida topilgan va tuzatilgan xato

**Rollback skriptlarida vaqt-mintaqa siljishi.**
`to_char(m."createdAt" AT TIME ZONE 'UTC', ...)` — `createdAt` `timestamp(3)`
(mintaqasiz, UTC saqlaydi); `AT TIME ZONE 'UTC'` uni `timestamptz`ga
aylantirgani uchun `to_char` **sessiya mintaqasida** render qilgan
(Asia/Tashkent = UTC+5) → har timestamp **+5 soatga siljigan**.

- **Qanday topildi:** drop-migratsiyasidan keyin rollback tekshiruvida JSON
  `16:46:11Z` bergan, `Message.createdAt` esa `06:46:11Z` edi. Tasdiq:
  tegilmagan `Conversation.updatedAt` bilan solishtirilganda xabarlar suhbat
  yakunlanganidan **5 soat keyin** chiqib qolgandi — imkonsiz qiymat.
- **Ta'sir:** faqat **dev bazasi** (6 xabar). Prod bu migratsiyalarni hali
  bir marta ham qo'llamagan, ya'ni prod ma'lumoti tegilmagan.
- **Tuzatildi:** ikkala `rollback.sql` da `AT TIME ZONE 'UTC'` olib tashlandi
  + qayta kiritilmasligi uchun ogohlantiruvchi izoh qo'yildi. Dev qiymatlari
  aynan teskari amal bilan tiklandi (sessiya UTC-ofseti ayirildi; hardcode
  emas), keyin round-trip AYNAN mos ekani isbotlandi.
- **Nega A15 tekshiruvi buni sezmagan:** `message-backfill-verify.mjs` JSON
  bilan jadvalni solishtirgan — rollback→re-apply siklida IKKALA tomon ham
  birga siljigan, shuning uchun "mos" ko'ringan. Xatoni faqat **tashqi,
  tegilmagan ustun** (`Conversation.updatedAt`) bilan solishtirish ochdi.
  Saboq: round-trip tekshiruvi o'z-o'zini tasdiqlashi mumkin — mustaqil
  mos-yozuv bilan tekshirish kerak.

## Reliz tartibi (prod uchun MAJBURIY)

`20260808100000` (Message jadvali) va `20260808120000` (legacy DROP)
**bitta relizda chiqmasligi** kerak: `prisma migrate deploy` barcha
kutilayotgan migratsiyalarni ketma-ket qo'llaydi va rollback oynasini yo'q
qiladi. Tartib: A15 relizi → prod'da tekshiruv → bir necha kun barqarorlik →
DROP relizi. Batafsil: `docs/runbooks/phase3-message-migration.md` §6.
