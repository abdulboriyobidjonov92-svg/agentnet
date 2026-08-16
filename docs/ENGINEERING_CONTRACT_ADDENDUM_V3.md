---
doc: ENGINEERING_CONTRACT_ADDENDUM_V3
version: 1.0
status: ACTIVE
created: 2026-08-14
last_verified: 2026-08-14
supersedes: —
superseded_by: —
---

# ENGINEERING CONTRACT — ADDENDUM V3

**Sana:** 2026-08-14 · **Versiya:** 1.0 · **Holat:** ACTIVE
**Bazaviy commit:** `5659a78`
**Turi:** **Ilova** — [`ENGINEERING_CONTRACT.md`](ENGINEERING_CONTRACT.md) ni
**o'zgartirmaydi**. Contract FROZEN va bu hujjat unga bironta ham qator
qo'shmagan/o'zgartirmagan.

> **Ustunlik qoidasi:** Contract va V3 hujjatlari ziddiyatga kelsa —
> **CONTRACT YUTADI**. Har ziddiyat §3 da ochiq yozilgan va Contract
> tomonida hal qilingan.

**Bog'liq:** [`strategy/MASTER_ROADMAP_V3.md`](strategy/MASTER_ROADMAP_V3.md) ·
`adr/ADR-023` … `adr/ADR-032` ·
[`status/current-state-2026-08-13.md`](status/current-state-2026-08-13.md)

---

## 1. Nima O'ZGARDI va nega

V3 **uchta narsani** o'zgartirdi. Uchalasi ham Contract'ning o'z
o'zgartirish mexanizmi orqali — **yangi ADR bilan** (Contract sarlavhasi:
*"O'zgartirish tartibi: faqat yangi ADR orqali"*).

### 1.1 Ish tartibi (Contract §3 fazalari EMAS — strategik bosqichlar)

| Element | Contract joyi | V3 joyi | ADR | Sabab |
|---|---|---|---|---|
| Token/usage metering | Phase 7 | **V3-P0** | ADR-023 | Metering — o'lchov, narxlash emas; u Phase 6-C ga texnik bog'liq emas. Bugun zarar hajmi **umuman noma'lum** (`Message.tokensIn` kodda 0 marta yoziladi `[MEASURED]`) |
| Minimal policy engine + kill switch | (Contract'da agent-darajasida yo'q) | **V3-P0** | ADR-031 doirasida, spetsifikatsiya `SAFETY_POLICY_LAYER.md` | Agent bugun SMS yuboradi, pul sarflaydi, davlat hujjati topshiradi — uchalasi bir vaqtda `[MEASURED]` |
| Execution trace + approval logging | §6.5 (faqat **admin** amallari) | **V3-P0** (agent amallari ham) | ADR-023 | Human approval data — eng nodir moat; bugun yig'ilmasa hech qachon olinmaydi |
| Minimal eval harness | (yo'q) | **V3-P1** | ADR-028 | Model routing evalsiz xavfli |
| pgvector / memory | (yo'q; `texnik-strategiya.md` da g'oya sifatida) | **V3-P1/P2** | ADR-027 | Kech qo'yish = arxitektura qayta yozish |
| MCP server | (yo'q) | **V3-P2** | ADR-029 | Eng arzon distribution kanali |
| Besh tier plan modeli | (yo'q; A28 faqat ikki o'q) | **V3-P1** | ADR-024 | Tarif ajratish tamoyili yozilmagan edi |

### 1.2 Uch trekli ijro modeli

Contract §3 chiziqli ketma-ketlik beradi. V3 **kod bilan bloklanmagan**
ishlarni (merchant onboarding, huquqiy hujjatlar, IT Park, pilot
suhbatlari) muhandislik navbatidan chiqaradi. **ADR-031.**

⚠️ **Bu Contract §3 ni buzmaydi:** "fazalar qayta tartiblanmaydi" qoidasi
Product/Engineering trekiga tegishli va u trek ichida **to'liq kuchda
qoladi**.

### 1.3 Build-vs-Buy qoidasi

Yangi majburiy darvoza: *"keng va umumiy narsani sotib ol, chuqur va
mahalliy narsani qur"* — har yangi tashqi bog'liqlik uchun to'rt savol
([`strategy/BUILD_VS_BUY.md`](strategy/BUILD_VS_BUY.md) §0).
**ADR-025, ADR-026, ADR-027.**

Bu Konstitutsiya #40 ("yangi tashqi bog'liqlik ADR bilan asoslanadi") ning
**kuchaytirilgan shakli** — u bilan ziddiyatda emas.

---

## 2. Nima O'ZGARMADI

**Hech biri o'zgarmadi. Hammasi kuchda.**

### 2.1 Arxitektura yadrosi (Contract §1 — "hech qachon o'zgarmaydi")

Barcha 10 band o'zgarishsiz:
prepaid atomik yechish · BFF+httpOnly izolyatsiya · engine hech qachon
ommaviy emas · at-rest shifrlash yagona nuqtadan · egalik-scoped so'rovlar ·
hash-zanjirli AuditLog · halal filtr yadro qatlami · uz/ru/en uchligi ·
Postgres yagona haqiqat manbai · LLM-first + deterministik fallback.

### 2.2 A1–A40

Barcha 40 qaror (`KEEP`/`MODIFY`/`REMOVE` statuslari bilan) **o'zgarishsiz**.
V3 ularning **birortasini ham** bekor qilmaydi.

Ayniqsa muhimlari:
- **A10** (Postgres yagona manba) — pgvector **kengaytma**, ikkinchi
  tranzaksion DB emas. ADR-027 buni aniq yozadi.
- **A19/ADR-006** (Redis faqat 3 maqsad, kesh emas) — V3 kesh qo'shmaydi.
- **A21/ADR-010** (browser-worker o'zimizda) — ADR-026 buni **bekor
  qilmaydi**, §3.2 ga qarang.
- **A28** (ikki billing o'qi) — ADR-024 faqat platforma obunasi o'qini
  aniqlashtiradi.
- **A29** (creator payout blocked-stub) — V3 da ham shu holatda,
  demand gate ortida.
- **A39/ADR-020** (feature freeze + kill-criteria) — V3 uni **bajaradi**
  (`KILL_CRITERIA.md`), buzmaydi.

### 2.3 Konstitutsiya (§11, 1–55 qoidalar)

Barcha 55 qoida kuchda. V3 hujjatlari ularga **yangi qoida qo'shmaydi**,
faqat ba'zilarini kengaytiradi:

| Qoida | V3 kengaytmasi |
|---|---|
| #9 (xavfli amal: sabab + re-auth + 2 audit) | Agent amallariga ham (SAFETY_POLICY_LAYER §2) |
| #17 (har pul o'zgarishi ledger'ga) | Internal cost **ledger emas** — u alohida o'lchov (ADR-023) |
| #20 (BigInt tiyin, float yo'q) | Pricing engine ham BigInt (PRICING §2.2) |
| #21 (xizmat ko'rsatilmasa pul qaytariladi) | Reversibility jadvali (SAFETY_POLICY_LAYER §5) |
| #40 (yangi bog'liqlik ADR bilan) | + Build-vs-Buy to'rt savoli |

### 2.4 ADR-001 … ADR-022

Barchasi kuchda. **Birortasi ham `SUPERSEDED` deb belgilanmadi.**

---

## 3. ⚠️ TO'QNASHUV RO'YXATI

Har band: **nima to'qnashadi · qanday hal qilindi · Contract holati.**

### 3.1 Contract §3 "fazalar qayta tartiblanmaydi" vs V3 tartibi

| | |
|---|---|
| **To'qnashuv** | Contract §3 metering'ni Phase 7 ga qo'ygan; V3 uni V3-P0 ga ko'chirdi |
| **Hal** | Contract'ning **o'z mexanizmi** ishlatildi: yangi ADR (ADR-023). Contract sarlavhasi aynan shunday deydi: *"O'zgartirish tartibi: faqat yangi ADR orqali"*. Ya'ni bu — qoidani buzish emas, qoidani **bajarish** |
| **Qo'shimcha aniqlik** | Contract Phase 0–5 bajarilgan `[FROM-AUDIT]`, Phase 6 A/B bajarilgan `[MEASURED]`. Ko'chirilgan yagona ish — metering, va u Phase 6-C (`browser-worker`) ga **texnik bog'liq emas** |
| **Holat** | ✅ Hal qilindi. Contract ustun — va u buzilmadi |

### 3.2 ⚠️ ADR-010 (Browserbase RAD ETILGAN) vs ADR-026 (shartli sotib olish)

| | |
|---|---|
| **To'qnashuv** | ADR-010: *"Browserless/Browserbase — … qabul qilinmaydi"*. ADR-026 managed brauzerni qayta ko'radi |
| **Hal** | **CONTRACT USTUN.** ADR-010 **kuchda qoladi**. ADR-026 holati — `PROPOSED`, qabul qilinmagan. U faqat **buzilmas shart** bajarilganda ko'riladi: sessiya holati (`storageState`) vendor infratuzilmasiga **hech qachon** yuborilmaydi; vendor faqat anonim ishlar uchun |
| **Agar shart bajarilmasa** | ADR-026 `REJECTED` deb yopiladi, Contract A21 yo'li (o'z `browser-worker`, 8 ED) to'liq bajariladi |
| **Holat** | ⚠️ **OCHIQ TANGLIK** — V3-P2 da hal qilinadi. Bugun hech qanday kod yozilmaydi |

### 3.3 Konstitutsiya #38 (o'lik kod darhol o'chiriladi) vs `ARCHIVE` holati

| | |
|---|---|
| **To'qnashuv** | #38: *"O'lik kod darhol o'chiriladi — 'keyin kerak bo'ladi' taqiqlanadi"*. ADR-032 esa `ARCHIVE` holatini kiritadi: UI'dan olinadi, kod qoladi |
| **Hal** | #38 **yangi yozilgan** o'lik kod haqida (spekulyativ kod taqiqi). `ARCHIVE` esa **jonli, testlar bilan qoplangan** modulni to'xtatish haqida. Ularni bir kunda o'chirish regressiya riski va foydalanuvchiga to'satdan yo'qotish demak |
| **Chegara (majburiy)** | `ARCHIVE` holati **cheksiz emas**: arxivlangan modul **keyingi tozalash siklida** (maks. 2 chorak) `KILL` ga o'tadi yoki qayta faollashtiriladi. Cheksiz `ARCHIVE` = #38 buzilishi |
| **Holat** | ⚠️ **Yumshatilgan tanglik** — chegara bilan hal qilindi. Contract ustun |

### 3.4 Contract ADR-002 "policy engine rad etilgan" vs V3 "policy engine"

| | |
|---|---|
| **To'qnashuv** | ADR-002 CASL/OPA'ni rad etgan (*"tashqi policy engine — 1 muhandis uchun operatsion aql-bovar qilmas"*). V3 "minimal policy engine" deydi |
| **Hal** | **Ular boshqa narsa.** ADR-002 — **avtorizatsiya** (kim nima qila oladi, RBAC). V3 policy engine — **risk tier** (amal qanchalik xavfli, inson tasdig'i kerakmi). Ular boshqa qatlam va bir-birini almashtirmaydi. V3 **tashqi** policy engine kiritmaydi |
| **Holat** | ✅ Ziddiyat yo'q — terminologik ustma-ustlik. Aniqlik shu yerda qayd etildi |

### 3.5 "Contract §30 ro'yxati" — mavjud emas

| | |
|---|---|
| **To'qnashuv** | V3 brifi "Nima qurilmaydi — Contract §30 ro'yxati" ga havola qiladi. Contract'da **§30 bo'limi yo'q** (u 13 bo'limdan iborat; #30 — Konstitutsiya qoidasi, `onDelete: Cascade` haqida) |
| **Hal** | `MASTER_ROADMAP_V3.md` §18 ("Nima qurilmaydi") Contract'ning **haqiqiy** rad etilgan qarorlaridan yig'ildi: §2 "Rad etildi" qatorlari, §5 ADR "Why rejected", A39/ADR-020 |
| **Holat** | ✅ Hal qilindi, manba almashtirildi va ochiq belgilandi |

### 3.6 ADR fayl nomlash konvensiyasi

| | |
|---|---|
| **To'qnashuv** | Contract §5: `docs/adr/NNNN-<mavzu>.md`. Mavjud fayllar: `0021-…`, `0022-…`. Yangi fayllar esa `ADR-023-…` shaklida (brifda aynan shunday ko'rsatilgan) |
| **Hal** | Yangi fayllar brifdagi nom bilan yaratildi. Bu **kosmetik nomuvofiqlik**, mazmunga ta'sir qilmaydi |
| **Tavsiya** | Bir marta yagona konvensiyaga keltirish (`0023-…` yoki hammasini `ADR-…` ga) — alohida kichik ish |
| **Holat** | ⚠️ Ochiq (past ustuvorlik) |

### 3.7 ADR bo'lim sarlavhalari

| | |
|---|---|
| **To'qnashuv** | Brif "Context · Decision · Alternatives considered · Consequences · Status · Supersedes" so'radi; repozitoriy formati (ADR-021/022) — "Problem · Decision · Alternatives · Why rejected · Long-term impact" + sarlavha blokida `Holat` |
| **Hal** | Repozitoriy formati saqlandi (brif "mavjud ADR formatini aynan takrorla" deydi). Moslik: Context→Problem, Consequences→Long-term impact, Status/Supersedes→sarlavha bloki |
| **Holat** | ✅ Hal qilindi |

### 3.8 i18n kalitlar soni

| | |
|---|---|
| **Nomuvofiqlik** | Contract §5 ADR-013 va §13.3: **789 kalit**. O'lchov: **860 × 3** `[MEASURED]` |
| **Hal** | Contract raqami — 2026-08-02 holati; kod o'shandan beri o'sgan. **Ziddiyat emas, eskirgan raqam.** Contract o'zgartirilmaydi |
| **Holat** | ✅ Qayd etildi |

### 3.9 Contract §5 talabi: ADR-001…020 alohida fayllarga ko'chirilsin

| | |
|---|---|
| **Talab** | Contract §5: *"Bular `docs/adr/` ga alohida fayllar sifatida ko'chiriladi"* — 2026-08-14 gacha bajarilmagan edi |
| **Hal** | **BAJARILDI** — `ADR-001-authentication.md` … `ADR-020-feature-governance.md` yaratildi. Mazmun **o'zgartirilmadi**; har faylda `Source: ENGINEERING_CONTRACT.md §5` ko'rsatilgan |
| **Qo'shimcha** | Ba'zi fayllarda V3 eslatmasi qo'shildi (ADR-002, 008, 010, 012, 013, 018, 019, 020) — ular **asl matndan tashqarida**, aniq ajratilgan blokda va faqat V3 bilan bog'lanishni ko'rsatadi |
| **Holat** | ✅ Hal qilindi |

### 3.10 Contract §12 metrikalari vs V3 METRICS.md

| | |
|---|---|
| **Munosabat** | Ziddiyat **yo'q**. Contract §12 — muhandislik KPI'lari (coverage, CI, latency, xavfsizlik). `METRICS.md` — iqtisod/qiymat/o'sish qatlami |
| **Holat** | ✅ To'ldiruvchi |

---

## 4. Ochiq bandlar jamlanmasi

| # | Band | Ustuvorlik | Qachon |
|---|---|---|---|
| O1 | ADR-026 tangligi (managed brauzer vs ADR-010) | Yuqori | V3-P2 |
| O2 | `ARCHIVE` → `KILL` chegarasi (maks. 2 chorak) | O'rta | Har chorak |
| O3 | ADR fayl nomlash konvensiyasi | Past | Istalgan vaqt |
| O4 | ~~ADR-001…020 ni alohida fayllarga ko'chirish~~ — **bajarildi** (§3.9) | — | ✅ 2026-08-14 |
| O5 | Contract Phase 6-C (`apps/browser-worker`) — hali bajarilmagan | Yuqori | V3-P0/P2 |
| O6 | README eskirgan (Clerk hamon texnologiya jadvalida) `[MEASURED]` | Past | Istalgan vaqt |

---

## 5. Bu hujjat qanday saqlanadi

- Contract **hech qachon** bu hujjat sababli o'zgartirilmaydi.
- Yangi ziddiyat topilsa — §3 ga **yangi band** qo'shiladi, eski bandlar
  o'chirilmaydi.
- Ziddiyat hal qilinganda band `✅` deb belgilanadi, olib tashlanmaydi.
- Har V3 bosqichi oxirida bu hujjat qayta o'qiladi va §4 yangilanadi.
