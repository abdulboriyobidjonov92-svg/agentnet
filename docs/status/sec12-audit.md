# SEC-12 — impersonation va Users yozish amallari: dizayn qarorlari va holat

**Sana:** 2026-08-09 · **Contract:** §6.6, §6.1, §6.5, §6.4, ADR-008, Konstitutsiya #9/#10
**Oldingi bosqich:** [`sec11-audit.md`](sec11-audit.md) (xavfli amallar frameworki)

## 1. Nima qurildi

Ikki blok, ikkalasi ham MAVJUD infratuzilma ustiga:

1. **Impersonation** (§6.6) — 30 daqiqalik, faqat-o'qish, to'liq auditlanadigan
   qo'llab-quvvatlash sessiyasi. Ikkinchi auth stack YO'Q: ayni HS256 JWT,
   faqat da'volari boshqa; server tomonda `ImpersonationSession` qatori.
2. **Users yozish amallari** — qo'lda kredit va blok/blokdan chiqarish.
   Ikkinchi tasdiqlash mexanizmi YARATILMADI: uchala amal ham SEC-11
   registriga qo'shildi va o'sha oqimdan (sabab → TOTP → yozib tasdiqlash →
   `intent`/`result` audit → holat mashinasi) o'tadi.

| §6.6 talabi | Holat | Qayerda |
|---|:---:|---|
| Sabab majburiy | ✅ | `StartImpersonationDto` (trim + `@MinLength(20)`) |
| Maks. 30 daqiqa | ✅ | JWT `exp` + DB `expiresAt` + `verifyToken` chegarasi |
| Read-only default | ✅ | `ImpersonationGuard` (metod darajasida) |
| Taqiqlangan amallar guard'da | ✅ | `impersonation.policy.ts` + guard |
| Qizil banner + timer | ✅ | `impersonation-banner.tsx` |
| Har so'rov auditi | ✅ | guard (rad) + interceptor (ruxsat) |
| Nishonga bildirishnoma | ✅ (yetkazish TEKSHIRILMAGAN) | `impersonation-notifier.service.ts` |
| Faqat Audit Viewer'dan keyin | ✅ | Audit Viewer Phase 4a'da yetkazilgan |

## 2. Nega SEC-11 oqimi impersonation uchun TO'LIQ qo'llanmadi

Contract §6.5 xavfli amallar ro'yxatida **"impersonation (write)"** turadi —
ya'ni faqat YOZISH rejimi xavfli deb tasniflangan. O'qish sessiyasini ikki
bosqichli `pending → execute` mashinasiga solish qo'llab-quvvatlash
chaqirig'ini ishlamaydigan qiladi (operator mijoz bilan gaplashib turib
ikkinchi tasdiqni kutolmaydi), §6.5(5) "bekor qilish oynasi" esa bu yerda
ma'nosiz — sessiya 30 daqiqada o'zi o'ladi.

Shunga qaramay §6.5 ning HIMOYA QILADIGAN qismlari olindi:

| §6.5 qadami | Impersonation'da | Sabab |
|---|:---:|---|
| Sabab (20 belgi) | ✅ | AYNAN bir xil konvensiya |
| TOTP re-auth | ✅ **kuchaytirilgan** | pastda, §3 |
| Yozib tasdiqlash | ❌ | qaytariladigan, to'liq auditlanadigan o'qish sessiyasi |
| Ikkita audit yozuvi | ✅ | `impersonation.start` + `impersonation.end` |
| 24s kechikish | ❌ | §6.5(5) buni faqat o'chirish uchun belgilaydi |
| OWNER signali | ✅ | mavjud `AdminAlertService` |
| 10/soat throttle | ✅ | controller darajasida |

## 3. Ataylab KUCHAYTIRILGAN: TOTP

Contract §6.6 TOTP ni nomma-nom talab qilmaydi. Biz uni **majburiy** qildik.

Sabab: `RolesGuard.ELEVATED_ROLES` faqat OWNER/ADMIN ni qamraydi, ya'ni
**SUPPORT 2FA majburiyati ostida emas**. Usiz o'g'irlangan bitta SUPPORT
sessiyasi platformadagi ISTALGAN mijoz hisobini o'qiy olardi — SEC-12
doirasidagi eng katta qoldiq risk aynan shu edi. Kuchaytirish hech kimni
qulflab qo'ymaydi: 2FA `/auth/2fa/*` orqali o'z-o'zidan yoqiladi.

## 4. Avtorizatsiya matritsasi

Yagona manba: `auth/role-rank.ts` (`outranks`) + `auth/impersonation.policy.ts`.
Qoida bitta: **nishon roli aktordan QAT'IY past bo'lishi shart.**

| Aktor \ Nishon | OWNER | ADMIN | SUPPORT | MEMBER | VIEWER |
|---|:---:|:---:|:---:|:---:|:---:|
| OWNER | ❌ | ✅ | ✅ | ✅ | ✅ |
| ADMIN | ❌ | ❌ | ✅ | ✅ | ✅ |
| SUPPORT | ❌ | ❌ | ❌ | ✅ | ✅ |
| MEMBER / VIEWER | ❌ | ❌ | ❌ | ❌ | ❌ |

Shu bitta qoidadan KELIB CHIQADI (alohida "himoyalangan hisoblar ro'yxati"
saqlanmaydi — uni unutib qoldirib bo'lmaydi):

- OWNER hech kim tomonidan impersonation qilinmaydi (§6.7 break-glass izi toza qoladi);
- teng rollar bir-birini ko'rmaydi (ADMIN→ADMIN, SUPPORT→SUPPORT — ❌);
- o'z-o'zini impersonation qilish yopiq (servis buni ALOHIDA ham tekshiradi,
  aniqroq xato xabari uchun);
- past rol yuqorini ko'ra olmaydi.

Qo'shimcha to'siqlar: bloklangan nishon uchun sessiya ochilmaydi (aks holda u
har so'rovda 403 beradigan "o'lik sessiya" bo'lardi); bir operatorda bir
vaqtda BITTA faol sessiya (eskisi avtomatik yopiladi).

**Yozish amallari** (§6.1 matritsasi bo'yicha):

| Amal | OWNER | ADMIN | SUPPORT |
|---|:---:|:---:|:---:|
| Qo'lda kredit | ✅ | ✅ (≤500k so'm/24s) | ❌ |
| Bloklash / blokdan chiqarish | ✅ | ✅ | ❌ |
| Rol tayinlash | ✅ | ❌ | ❌ |
| Sessiyalarni bekor qilish | ✅ | ❌ | ❌ |

Controller `@Roles(OWNER, ADMIN)` ga kengaytirildi; `role_assign` va
`session_revoke` esa registrdagi `allowedRoles` tufayli FAQAT OWNER'da
qoldi — SEC-11 dagi ikki darvozali dizayn aynan shu holat uchun qurilgan
edi va test bilan qulflandi.

## 5. Token / xavfsizlik modeli

```
typ  = "impersonation"     -> bu oddiy sessiya EMAS
sub  = <nishon>            -> "men kimman" savoliga javob (butun kod-baza shundan o'qiydi)
act  = <haqiqiy operator>  -> AVTORIZATSIYA egasi
imp  = <ImpersonationSession.id>
mode = "READ_ONLY"
tv   = <nishonning tokenVersion'i>
exp  = iat + 30 daqiqa
```

**Ikkinchi imzo-kaliti YO'Q**, ikkinchi auth stack YO'Q — `token.util.ts`
ning o'sha `signToken/verifyToken` yo'li.

Uchta fail-closed qoida `verifyToken` ichida (DB'ga borishdan OLDIN):

1. `act`/`imp`/`mode` bor, lekin `typ` yo'q → RAD (aralash token jimgina
   oddiy sessiya bo'lib o'tmaydi);
2. `typ=impersonation`, lekin da'volar to'liq emas yoki `mode` noma'lum → RAD
   (`READ_WRITE` da'vosi ham shu yerda o'ladi);
3. `exp - iat > 30 daqiqa` → RAD, **imzo to'g'ri bo'lsa ham**.

DB qatori (`ImpersonationSession`) — SERVER TOMONIDAGI HAQIQAT; token unga
faqat havola. Har so'rovda tekshiriladi: qator bor · da'volar qator bilan
AYNAN mos · holat `active` · muddat o'tmagan · aktor bor, bloklanmagan,
roli hali ham ruxsat beradi · aktorning `tokenVersion`i o'zgarmagan.

**Bekor qilish (§16)** — to'rt yo'l, hammasi ishlaydi:

| Hodisa | Natija |
|---|---|
| Operator "To'xtatish"ni bosdi | qator `ended`, token darhol o'lik |
| Operator sessiyalari bekor qilindi (SEC-03) | `actorTokenVersion` mos kelmaydi → `revoked` |
| NISHON sessiyalari bekor qilindi | JWT `tv` mos kelmaydi → `AuthGuard` 401 (mavjud mexanizm) |
| 30 daqiqa o'tdi | `expired` (birinchi so'rovda yoki cron bilan) |

## 6. Taqiqlangan amallar — guard darajasida, RO'YXATSIZ

`ImpersonationGuard` ikkita qoida bilan ishlaydi; ikkalasi ham qo'lda
saqlanadigan endpoint ro'yxatiga TAYANMAYDI:

1. **`GET/HEAD/OPTIONS` dan boshqa hamma narsa 403.** Bu bitta qoida §8
   dagi butun ro'yxatni qoplaydi — parol/2FA, email/telefon, rol tayinlash,
   sessiya bekor qilish, API kalitlari, konnektor sirlari, to'lov/payout,
   obuna, xavfli amallar, hisobni o'chirish, qurilma buyruqlari — chunki
   ularning HAMMASI POST/PATCH/PUT/DELETE. Yangi yozish endpointi
   AVTOMATIK qamraladi.
2. **Maxfiy O'QISH prefikslari 403:** `device` (qo'ng'iroq yozuvlari,
   companion, buyruq navbati), `users/me/export` (GDPR dampi), `auth/2fa`.
   Prefiks bo'yicha — `device/...` ostidagi yangi endpoint ham avtomatik.

**Imtiyozli yo'llar alohida yopiladi:** `RolesGuard` `@Roles(...)` bilan
himoyalangan HAR QANDAY yo'lni impersonation uchun rad etadi va bu tekshiruv
nishonning roliga UMUMAN QARAMAYDI. Sabab — "confused deputy": nishon ADMIN
bo'lsa, oddiy rol solishtiruvi uni o'tkazib yuborardi. Natijada butun
`admin/*` yuzasi (jumladan SEC-11 xavfli amallari va yangi impersonation
boshlash) impersonation ichidan yopiq — zanjir hujumi mumkin emas.

**Topilgan va tuzatilgan bo'shliq (BFF):** `apps/web/src/app/api/chat/stream`
va `.../device/browser/stream` route'lari `middleware.ts` proksisidan
O'TMAYDI — ular cookie'ni o'zlari o'qiydi. Ya'ni impersonation paytida bu
ikki yo'l OPERATORNING O'Z tokeni bilan ketardi: chat operator hisobidan pul
yechib, uning kvotasini sarflab, jurnalda oddiy admin amali bo'lib
ko'rinardi. Ikkalasiga ham aniq `403 impersonation_read_only` qo'yildi.

## 7. Audit

Har hodisa mavjud A17 zanjiriga yoziladi (parallel audit bazasi YO'Q):

| Hodisa | `action` | `actorId` | `impersonatedUserId` |
|---|---|---|---|
| Boshlash | `impersonation.start` | operator | nishon |
| Rad etilgan boshlash | `impersonation.start.denied` | operator | — |
| Har so'rov (ruxsat) | `impersonation.request` | operator | nishon |
| Har so'rov (rad) | `impersonation.request.denied` | operator | nishon |
| Tugash | `impersonation.end` | operator | nishon |

`actorId` **HAR DOIM** haqiqiy operator — zanjir shu aktorda o'sadi. Ya'ni
"foydalanuvchi o'zi qildi" va "admin uning nomidan qildi" hech qachon
chalkashmaydi (jonli tekshiruvda tasdiqlandi: nishon zanjirida 0 ta
`impersonation.*` yozuvi).

**Kanonik hash O'ZGARMADI (§12 talabi).** `AuditLog.impersonatedUserId`
ustuni qo'shildi, LEKIN u `computeEntryHash` kirishida YO'Q. Buzilmas nusxa
`metadata.impersonatedUserId` da yashaydi (metadata allaqachon hashlanadi);
ustun — indekslanadigan ko'chirma (admin jurnalidagi `impersonatedBy?`
ustuni va nishon bo'yicha filtr shundan ishlaydi). Ustunni o'zgartirish
metadata bilan solishtirilganda darhol ko'rinadi.

**Vazifa bo'linishi guard/interceptor:** NestJS'da guardlar interceptor'dan
OLDIN ishlaydi, ya'ni guard rad etgan so'rov interceptor'ga yetib kelmaydi.
Shuning uchun rad etilganini guard, ruxsat berilganini (haqiqiy HTTP holati
bilan) interceptor yozadi.

**Narx:** har impersonation so'rovi — bitta advisory-lock'li audit
tranzaksiyasi. Ataylab qabul qilindi: sessiya 30 daqiqa bilan chegaralangan,
nazoratsiz impersonation esa Contract bo'yicha umuman taqiqlangan.
Interceptor javobni KUTMAYDI (fire-and-forget) — o'qish latencysiga
qo'shilmasligi uchun.

## 8. Bildirishnoma

Mavjud yo'l qayta ishlatildi: `ConnectorsService.sendViaChannel(user,
'telegram', ...)` — bu platformadagi yagona "foydalanuvchiga xabar" kanali
(`device-companion` juftlash ogohlantirishi va `agent-billing` muzlatish
xabari ham shundan boradi). Parallel bildirishnoma tizimi yaratilmadi.

**Qachon:** sessiya TUGAGANDA (aniq to'xtatish yoki muddat) — Contract §6.6
shuni aytadi. Har ikkala yo'l bitta metodga boradi, `notifiedAt` takror
yuborishni to'sadi.

**Nima yozilmaydi:** operator emaili/id'si, sessiya id'si, ko'rilgan
sahifalar. Foydalanuvchiga FAKT + SABAB + VAQT + DAVOMIYLIK beriladi.
Operatorni nomlash uni shaxsiy tahdid ostiga qo'yardi; "kim" savoliga audit
jurnali javob beradi.

Sabab matni Telegram HTML uchun **escape** qilinadi (`escapeTelegramHtml`).
Usiz operator yozgan bitta `<` belgisi butun xabarni Telegram tomonidan
rad etdirardi — ya'ni shaffoflik xabari JIMGINA yo'qolardi. Ayni funksiya
SEC-11 dagi OWNER signaliga ham qo'llandi (o'sha bug u yerda ham bor edi).

> **Jonli yetkazib berish TEKSHIRILMAGAN — muhit cheklovi.** Bu muhitda
> Telegram bot kredensiallari yo'q. Kod yo'li testlar bilan qoplangan;
> haqiqiy yetkazish operator env'ni to'ldirgach tasdiqlanishi kerak
> (SEC-11 dagi bilan bir xil holat).

## 9. Qo'lda kredit

- **Chegara emas, oqim:** §6.5 matnida faqat ">500k so'm" xavfli deyilgan.
  Kichik summani oqimdan tashqarida qoldirish IKKINCHI (nazoratsiz) kredit
  yo'lini talab qilardi — shuning uchun **butun** pul yo'li registrga olindi.
  500k chegarasi yo'qolmadi: u ADMIN uchun **kunlik** limitga aylandi
  (`ADMIN_DAILY_CREDIT_CAP_TIYIN`); OWNER cheklanmagan.
- **Manfiy summa MUMKIN EMAS:** DTO `@Matches(/^[1-9][0-9]{0,18}$/)` (satr —
  A13 BigInt shartnomasi), servis ikkinchi marta tekshiradi. Balansdan
  yechish §6.1 da ALOHIDA (faqat OWNER) amal va bu yo'ldan bajarilmaydi.
- **Fat-finger to'sig'i:** bitta amalda maks. 10 mln so'm — rolidan qat'i
  nazar.
- **O'ziga kredit TAQIQLANGAN.**
- **Atomiklik:** `pg_advisory_xact_lock(4776, hashtext(actorId))` ostida
  kunlik chegara QAYTA hisoblanadi (tasdiq 24 soat yashaydi — so'rov
  paytidagi hisob eskirgan bo'lishi mumkin), so'ng mavjud
  `WalletCreditService.credit()` chaqiriladi: `user.update` + `CreditLedger`
  bitta tranzaksiyada. "Naive `balance = balance + amount`" YO'Q, daftarsiz
  pul harakati YO'Q.
- **Provenans:** yangi `LedgerKind.admin_credit` — to'lov provayderidan
  kelgan pul (`topup`) bilan operator qo'li bilan yozilgan pul daftar
  darajasida ajraladi (aks holda `/admin/billing/reconcile` ma'nosini
  yo'qotardi).
- **Takror bajarish:** `pending → executed` shartli o'tishi (`count === 1`).

## 10. Blok / blokdan chiqarish

- **Yangi status arxitekturasi yaratilmadi:** `User.blockedAt/blockedReason/
  blockedById`. Platformada allaqachon uch xil "to'xtatilgan" o'qi bor
  (`Agent.frozen`, `platformPlanFrozen`, endi hisob bloki) — ularni bitta
  status maydoniga siqish mavjud mantiqni qayta yozishni talab qilardi.
- **Himoyalangan hisoblar:** impersonation bilan AYNAN bir qoida
  (`outranks`) — OWNER hech kim tomonidan bloklanmaydi, ADMIN boshqa
  ADMIN'ni bloklay olmaydi, o'zini bloklash yopiq (self-lockout).
- **Atomik:** `updateMany` + kutilgan holat sharti; `count === 0` bo'lsa
  "holat bu orada o'zgargan" deb rad etiladi.
- **Sessiyalar:** bloklashda `tokenVersion++` (mavjud SEC-03 mexanizmi) —
  barcha tokenlar darhol 401. Blokdan chiqarishda OSHIRILMAYDI (eski
  tokenlar allaqachon o'lik; yana oshirish boshqa qurilmalarni keraksiz
  chiqarib yuborardi).
- **Ikki qatlamli majburlash:** `AuthGuard` bloklangan `dbUser` ni 403
  qiladi (`reason: 'account_blocked'`), `AuthService.issueSession` esa
  login yo'lida ANIQ sabab beradi — aks holda foydalanuvchi "kirgandek"
  bo'lib, keyin har so'rovda 403 olardi.

## 11. Poyga (§25) — jonli tasdiqlangan

Barcha holat o'tishlari shartli `updateMany`:

| O'tish | Shart | Tekshirildi |
|---|---|---|
| Xavfli amal `pending → executed` | `status = pending` | ✅ 2 parallel `execute` → 1 muvaffaqiyat, balans 1 marta oshdi |
| Impersonation `active → ended/expired` | `status = active` | ✅ `count 0` da tugash auditi TAKRORLANMAYDI |
| Blok `null → blocked` | `blockedAt = null` | ✅ |
| Blokdan chiqarish | `blockedAt != null` | ✅ |
| Kunlik kredit chegarasi | advisory-lock + qayta hisob | ✅ |

Cron (`expireDueSessions`, 5 daqiqada) leader-lock'siz — Contract A24
bo'yicha bu Phase 6 (Redis) ishi. Ko'p instansda ish takrorlanishi mumkin,
LEKIN `end()` atomik: ikkinchi instans `count: 0` oladi va na audit, na
bildirishnoma takrorlanadi.

## 12. Ataylab kuchaytirilgan: bajarish so'ragan odamga bog'landi

SEC-11 da bir OWNER so'rab, boshqasi bajarishi mumkin edi. Pul yo'li
qo'shilgach bu ikki muammo beradi: (a) ADMIN kunlik chegarasi bajaruvchiga
yozilib, ikki operator birgalikda uni chetlab o'ta oladi; (b) sabab+TOTP
bergan odam bilan ijro etgan odam ajralib, "kim javobgar" savoli auditda
ikkiga bo'linadi. Endi `execute()` `action.actorId === actor.id` ni talab
qiladi.

**Bekor qilish ATAYLAB ochiq qoldi** — §6.5(5) bekor qilish oynasini nazorat
vositasi sifatida beradi: OWNER boshqa operatorning kutilayotgan amalini
to'xtata olishi SHART.

## 13. Migratsiya

`20260809220000_sec12_impersonation_and_user_write_actions` — **to'liq
additive**: `ImpersonationSession` jadvali + 2 enum, `AuditLog.
impersonatedUserId`, `User.blocked*`, 3 yangi `DangerousActionKind`,
`LedgerKind.admin_credit`, 3 indeks.

QO'LDA TAHRIRLANDI (SEC-11 dagi bilan bir xil sabab): generator
`DROP TABLE "AuditLogHashBackup"` ni ham qo'shdi — u jadval A17
migratsiyasi tomonidan xom SQL bilan yaratilgan, ATAYLAB sxemada yo'q va
36 qatorli rollback to'ri. SEC-12 ga aloqasiz destruktiv amal sifatida
olib tashlandi.

Enum qo'shishlar `IF NOT EXISTS` bilan (generator qo'shmaydi): PostgreSQL
`ALTER TYPE ... DROP VALUE` ni qo'llab-quvvatlamaydi, ya'ni rollback enum
qiymatlarini ololmaydi — usiz "apply → rollback → re-apply" mashqi
`enum label already exists` bilan yiqilardi.

**Mashq bajarildi:** apply → rollback (`ImpersonationSession` tashlandi,
`blocked*` ustunlari ketdi, **19 user / 36 audit / 10 ledger / 36
hashBackup qatori butun**) → re-apply → `migrate status` toza (33
migratsiya).

## 14. Tekshiruv

**Birlik testlari:** 55 to'plam, 671 test (SEC-12 dan oldin: 51 / 560).
Yangi to'plamlar: `auth/impersonation-token.spec.ts` (11),
`auth/impersonation.spec.ts` (52), `admin/impersonation/
impersonation-admin.spec.ts` (20), `admin/dangerous/
users-write-actions.spec.ts` (28).

**Jonli Postgres bilan tasdiqlangan (34/34)** — mocklar isbotlay olmaydigan
xulq: token umri aynan 1800s, `AuthGuard` nishonni biriktirib aktorni
saqlashi, `@Roles` yo'lining yopiqligi, POST/qo'ng'iroq-yozuvi rad etilishi,
audit yozuvlarida aktor/nishon ajralishi, aktor `tokenVersion` o'zgarganda
sessiyaning o'lishi, yopilgan token qayta ishlatilmasligi, muddat tozalash,
haqiqiy balans+daftar o'zgarishi, parallel bajarishda faqat bittasining
o'tishi, blok+`tokenVersion`+`account_blocked`, va **A17 zanjirining
butunligi (aktor 14 yozuv, migratsiyadan OLDINGI zanjir 3 yozuv — ikkalasi
ham `ok: true`)**.

**Buildlar:** `prisma validate` ✅ · `tsc --noEmit` (api, web) ✅ ·
`eslint` (api 0 xato, web 0 xato) ✅ · `nest build` ✅ · `next build` ✅ ·
`migrate status` toza ✅.

## 15. Qolgan risklar va ataylab qilinmagan ishlar

1. **Telegram yetkazishi tekshirilmagan** (env yo'q) — §8 ga qarang.
2. **Throttle IP bo'yicha, operator bo'yicha emas.** `@Throttle` mavjud
   `ThrottlerGuard` ustida ishlaydi, u esa IP tracker'dan foydalanadi.
   SEC-11 dan meros; Contract A19 (Redis throttler store) Phase 6 ishi.
3. **Cron leader-lock'siz** — A24, Phase 6. Ta'siri yopilgan (§11).
4. **Impersonation yozish rejimi (§6.1 OWNER ✅) YOZILMADI.** U §6.5 da
   xavfli amal sifatida tasniflangan, ya'ni SEC-11 oqimi bilan birga
   kelishi kerak — alohida ijro birligi. `ImpersonationMode` enum'ida
   bitta a'zo (`READ_ONLY`) — DB darajasida "yozish rejimi mavjud emas"
   kafolati; qo'shilganda additive `ALTER TYPE ADD VALUE`.
5. **Foydalanuvchi detal sahifasi (§6.2 `/admin/users/[id]`) qurilmadi.**
   API'da `GET /admin/users/:id` bor, web'da yo'q — SEC-12 amallari
   mavjud ro'yxat qatoriga qo'yildi (SEC-11 da o'rnatilgan naqsh).
   Detal sahifasi Phase 4 ning qolgan qismi.
6. **Frontendda mutatsiya boshqaruvlari qatorma-qator o'chirilmadi.**
   §20 buni "where appropriate ... supplementary only" deb beradi. Qo'lda
   saqlanadigan tugmalar ro'yxati eskiradi (yangi tugma unutiladi), server
   esa YOZISHNI metod darajasida to'liq rad etadi. Shuning uchun: kuchli
   banner + `apiErrorMessage` da markazlashgan aniq sabab
   (`impersonation_read_only` → tarjima qilingan xabar).
7. **Sabab matni nishonga ko'rsatiladi.** Operator yozgan matn
   foydalanuvchiga boradi (shaffoflik talabi). HTML escape qilinadi, lekin
   MAZMUN nazorati yo'q — bu operator intizomi masalasi, auditda qoladi.
8. **A15 tizim-aktori hali qurilmagan** (SEC-11 dan meros topilma):
   `AuditLog.actorId` NON-NULL FK bo'lgani uchun foydalanuvchi
   o'chirilganda "o'chirildi" yozuvini qoldirib bo'lmaydi. SEC-12 buni
   o'zgartirmadi.

## 16. Fayllar

**API:** `prisma/schema.prisma` · migratsiya + `rollback.sql` ·
`auth/{token.util,auth.guard,roles.guard,auth.service,auth.module}.ts` ·
`auth/{role-rank,impersonation.types,impersonation.policy,
impersonation.service,impersonation.guard,impersonation-audit.interceptor}.ts` ·
`admin/impersonation/{impersonation.controller,impersonation-admin.service,
impersonation-notifier.service,dto/impersonation.dto}.ts` ·
`admin/dangerous/{dangerous-action.registry,dangerous-action.service,
dangerous-action.controller,admin-alert.service,dto/dangerous-action.dto}.ts` ·
`admin/{admin.module,admin-users.service,dto/admin-list.dto}.ts` ·
`billing/{wallet-credit.service,billing.module}.ts` · `app.module.ts`

**Web:** `middleware.ts` · `lib/{session,api-client}.ts` ·
`app/api/impersonation/route.ts` · `app/api/chat/stream/route.ts` ·
`app/api/device/browser/stream/route.ts` · `app/(dashboard)/layout.tsx` ·
`app/(admin)/admin/users/page.tsx` ·
`components/admin/{impersonation-banner,impersonate-dialog,
dangerous-action-dialog}.tsx` · `lib/i18n/locales/{en,ru,uz}.ts`
