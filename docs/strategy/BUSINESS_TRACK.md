---
doc: BUSINESS_TRACK
version: 1.0
status: ACTIVE
created: 2026-08-14
last_verified: 2026-08-14
supersedes: —
superseded_by: —
---

# BUSINESS TRACK — kod bilan bloklanmagan ishlar

**Sana:** 2026-08-14 · **Versiya:** 1.0 · **Holat:** ACTIVE
**Bog'liq:** [`MASTER_ROADMAP_V3.md`](MASTER_ROADMAP_V3.md) §4 (uch trek) · [`METRICS.md`](METRICS.md) · [`KILL_CRITERIA.md`](KILL_CRITERIA.md)

> **Trek qoidasi:** Business trek Product trekining tugashini **kutmaydi**.
> Bu yerdagi ishlarning aksariyati bitta ham qator kod talab qilmaydi.
> Ularni kechiktirish — sof yo'qotish.

---

## 1. Vazifa toifalari

| Toifa | Ma'nosi |
|---|---|
| **BLOCKER** | Bu bajarilmasa mahsulot pul olalmaydi / qonuniy ishlay olmaydi |
| **PARALLEL** | Product trek bilan bir vaqtda, bog'liqliksiz |
| **DEFERRED** | Ataylab keyinga — signal/gate ortida |

---

## 2. Kanal gipotezalari

Har kanal uchun: **gipoteza · sinov usuli · muvaffaqiyat mezoni · narx ·
toifa**. Mezon bajarilmasa kanal **yopiladi** (muhokama emas).

### K1 — Buxgalterlar

| | |
|---|---|
| **Gipoteza** | Buxgalter bir vaqtda 10–40 SME'ni yuritadi; u tavsiya qilsa, bir odam orqali o'nlab mijoz keladi. Soliq/Didox konnektorlari aynan uning og'rig'iga tegadi |
| **Sinov usuli** | 15 ta buxgalter bilan 30 daqiqalik suhbat; 5 tasiga soliq/Didox oqimini jonli ko'rsatish; 3 tasiga bepul pilot |
| **Muvaffaqiyat mezoni** | **≥2 buxgalter** o'z mijoziga tavsiya qiladi va **≥3 mijoz** ro'yxatdan o'tadi (30 kun) |
| **Narx** | Vaqt (≈20 soat), pul ~0 |
| **Toifa** | **PARALLEL** — hoziroq boshlanadi |

### K2 — Telegram

| | |
|---|---|
| **Gipoteza** | UZ biznes auditoriyasi Telegram'da yashaydi; kanal/guruhlar orqali arzon yetib borish mumkin. Telegram konnektori allaqachon bor `[MEASURED]` |
| **Sinov usuli** | 3 ta tematik kanalda (biznes/do'kon/buxgalteriya) kontent + 1 ta demo video; bot orqali "agent yarat" oqimi |
| **Muvaffaqiyat mezoni** | **CAC < $10** va **≥30 signup** (30 kun) |
| **Narx** | `[CALIBRATE]` — reklama byudjeti |
| **Toifa** | **PARALLEL** |

### K3 — POS / distribyutorlar

| | |
|---|---|
| **Gipoteza** | Do'konga POS sotgan kompaniya allaqachon ishonchli munosabatga ega; AgentNet ularning qo'shimcha mahsuloti bo'la oladi (retail wedge bilan aynan mos) |
| **Sinov usuli** | 5 ta POS provayderi/distribyutor bilan hamkorlik suhbati; 1 tasi bilan pilot integratsiya |
| **Muvaffaqiyat mezoni** | **≥1 imzolangan hamkorlik niyati** va **≥5 do'kon** pilotga kiradi (60 kun) |
| **Narx** | Vaqt + revenue share `[CALIBRATE]` |
| **Toifa** | **PARALLEL**, V3-P3 uchun kritik |

### K4 — Bozor / savdo markazlari

| | |
|---|---|
| **Gipoteza** | Bir joyda yuzlab do'kon; bitta savdo markazi ma'muriyati orqali ommaviy kirish mumkin |
| **Sinov usuli** | 2 ta savdo markazi ma'muriyati bilan suhbat; 1 ta joyda 10 do'konga jonli demo kuni |
| **Muvaffaqiyat mezoni** | **≥5 do'kon** demo kunidan keyin pilotga yoziladi |
| **Narx** | Vaqt + tadbir xarajati `[CALIBRATE]` |
| **Toifa** | **DEFERRED** — V3-P3 wedge tayyor bo'lgandan keyin (tayyor bo'lmagan mahsulotni 10 do'konga bir vaqtda ko'rsatish — brendga zarar) |

---

## 3. Kod bilan bloklanmagan vazifalar

| # | Vazifa | Toifa | Nega hozir | Bog'liqlik |
|---|---|---|---|---|
| B1 | **Payme merchant onboarding** (real merchant ID/kalit) | **BLOCKER** | Kod tayyor (real protokol `[FROM-AUDIT]`), lekin real to'lov qabul qilinmayapti. Bu — pul olishning old sharti | — |
| B2 | **Click merchant onboarding** | **BLOCKER** | Ayni sabab; ikkinchi provayder — uzilish himoyasi (Contract ADR-003) | — |
| B3 | **Privacy Policy + Terms of Service** (uz/ru/en) | **BLOCKER** | Shaxsiy ma'lumot qayta ishlanmoqda; roziliksiz ishlash — huquqiy risk | Yurist (§9 savollari) |
| B4 | **IT Park rezidentligi** | **PARALLEL** | 2040 gacha soliq imtiyozlari, 0% dividend solig'i `[FROM-RESEARCH]` — kechiktirish sof yo'qotish | — |
| B5 | **Yurist bilan savollar sessiyasi** (MASTER_ROADMAP_V3 §9) | **BLOCKER** | B3 va biometrik arxitektura qarori shunga bog'liq | — |
| B6 | **Soliq.uz / Didox rasmiy shartnomasi/statusi** | **PARALLEL** | Konnektorlar ishlaydi, lekin rasmiy status moatni mustahkamlaydi va enterprise suhbatini ochadi | — |
| B7 | **Eskiz SMS shartnomasi** (`ESKIZ_EMAIL`/`ESKIZ_PASSWORD` hali sozlanmagan `[MEASURED]`) | **BLOCKER** | Telefon orqali login hozir ishlamaydi — UZ bozorida bu asosiy kanal | — |
| B8 | **Creator payout rels** (bank/to'lov yo'li) | **DEFERRED** | Contract A29: payout blocked-stub holatida qoladi; demand gate ortida | Demand gate |
| B9 | **Shariah/halal tasdiq** (mustaqil ko'rik) | **PARALLEL** | Halal filtr — moat (§2 M7); tashqi tasdiq ishonchni ko'paytiradi | — |
| B10 | **Pilot shartnoma shabloni** (SLA'siz, oddiy) | **PARALLEL** | Pilotni og'zaki boshlash — keyinchalik bahs manbai | B3 |
| B11 | **Narx e'loni sahifasi** yangilanishi | **DEFERRED** | `[CALIBRATE]` — C3 (metering) dan oldin narx e'lon qilinmaydi | PRICING §8 |
| B12 | **Brend/pozitsiya matni** ("agent builder emas, execution qatlami") | **PARALLEL** | Bugungi README va landing "platforma" tilida gapiradi; North Star boshqa | — |
| B13 | **Referens/case study formati** | **DEFERRED** | V3-P3 outcome ma'lumotisiz case study — bo'sh va'da | V3-P3 |
| B14 | **Support kanali** (Telegram guruh yoki tiketsiz kanal) | **PARALLEL** | Birinchi pilot mijozdan oldin bo'lishi shart | — |

---

## 4. Pilot dasturi dizayni

### 4.1 Parametrlar

| Parametr | Qiymat | Manba |
|---|---|---|
| Mijoz soni (birinchi to'lqin) | **5** | `[CALIBRATE]` |
| Mijoz soni (90 kun maqsadi) | **10–20 to'lovchi** | `[CALIBRATE]` — default qaror |
| Muddat (bitta pilot) | **6 hafta** | `[CALIBRATE]` |
| Vertikal | **Retail** (do'kon + inventar + kamera) | Qaror |
| Narx | Chegirmali obuna (bepul emas) | Qaror — §4.4 |

### 4.2 Nima o'lchanadi

| # | O'lchov | Nega |
|---|---|---|
| P1 | **Tejalgan so'm / oy** | Asosiy outcome; §4.3 gate'i |
| P2 | Time-to-Value (birinchi natijagacha) | <10 daqiqa `[FROM-RESEARCH]` |
| P3 | Haftalik faol foydalanish | Retention prediktori |
| P4 | Agent success rate | Ishonch |
| P5 | Approval/override rate | Agent qanchalik mustaqil ishlay oladi |
| P6 | Qo'llab-quvvatlash so'rovlari / mijoz / hafta | Solo founder chegarasi signali |
| P7 | "Buni do'stingizga tavsiya qilasizmi?" | Sifat signali |

### 4.3 Muvaffaqiyat va to'xtatish mezoni

| Holat | Mezon | Qaror |
|---|---|---|
| ✅ **Davom** | Mijozlarning ≥50% ida tejamkorlik obuna narxidan **≥3×** katta | V3-P3 gate'i o'tdi |
| ⚠️ **Tuzat** | Tejamkorlik bor, lekin <3× | Narx yoki qamrov qayta ko'riladi |
| ❌ **To'xtat** | 6 hafta oxirida **≥3 mijozda** o'lchanadigan natija yo'q | Vertikal `EXPERIMENT` → qayta baholanadi ([`KILL_CRITERIA.md`](KILL_CRITERIA.md)) |
| ❌ **Darhol to'xtat** | Xavfsizlik hodisasi: agent ruxsatsiz pul/hujjat harakati qildi | Kill switch + post-mortem (Konstitutsiya #54) |

### 4.4 Nega pilot BEPUL emas

Bepul pilot **to'lov niyatini o'lchamaydi**. MIT NANDA: korporativ AI
pilotlarining 95% o'lchanadigan P&L ta'siri bermadi `[FROM-RESEARCH]` — va
ularning aksariyati bepul edi. Chegirmali (masalan 50%) narx:
- to'lov niyatini sinaydi,
- mijozni jiddiy foydalanishga majbur qiladi,
- keyingi narx suhbatini osonlashtiradi.

---

## 5. Business trek metrikalari

| Metrika | Qayerda | Yoqiladi |
|---|---|---|
| Kanal bo'yicha CAC | Bu hujjat §2 | K2 sinovi bilan |
| Pilot→to'lov konversiya | [`METRICS.md`](METRICS.md) G3.4 | V3-P3 |
| Referens tayyor mijoz soni | Bu hujjat §4 | V3-P3 |
| Kanal hamkorlari soni | §2 K3 | V3-P3 |
| Solo founder yuk signallari | MASTER_ROADMAP_V3 §12 | doimiy |

---

## 6. Nima QILINMAYDI (Business trek)

| Qilinmaydi | Nega |
|---|---|
| Katta konferensiya/tadbir sponsorligi | CAC o'lchanmagan holda katta xarajat |
| Sotuv jamoasi yollash | §12 resurs chegarasi signali kelmagan |
| Enterprise shartnoma (SSO/SLA va'dasi bilan) | Texnik asos yo'q — va'da berish qarz |
| Bepul cheksiz pilot | §4.4 |
| Narx e'loni (`[CALIBRATE]` holida) | PRICING §8 C3 |
| Ikkinchi vertikalga sotuv | V3-P3 gate'idan oldin — fokus yo'qoladi |
