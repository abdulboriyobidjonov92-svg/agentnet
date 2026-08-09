# SEC-11 — xavfli amallar: dizayn qarorlari va holat

**Sana:** 2026-08-09 · **Contract:** §6.5, §6.1, §6.7, Konstitutsiya #9/#10

## 1. Nima qurildi

§6.5 ning olti qadamli oqimi **framework** sifatida (`admin/dangerous/`),
va unga ulangan **ikkita real xavfli amal**: rol tayinlash va sessiyalarni
bekor qilish. Framework registr asosida ishlaydi — yangi xavfli amal
qo'shish uchun oqimni qayta yozish shart emas va uni "unutib qoldirib"
bo'lmaydi.

| §6.5 qadami | Holat | Qayerda |
|---|:---:|---|
| 1. Sabab (min 20 belgi) | ✅ | `CreateDangerousActionDto` (trim + `@MinLength(20)`) |
| 2. TOTP qayta-auth | ✅ | `assertTotp()` — so'rovda VA bajarishda |
| 3. Yozib tasdiqlash | ✅ | `expectedConfirmation()` — server hisoblaydi |
| 4. Ikki audit yozuvi | ✅ | `intent` + `result` (A17 kanonik zanjiri) |
| 5. Bekor qilish oynasi | ✅ | `DangerousAction` holat mashinasi (pastda) |
| 6. OWNER signali | ⚠️ konfiguratsiya kutilmoqda | `AdminAlertService` (pastda) |
| Rate limit 10/soat | ✅ | `@Throttle` controller darajasida |

## 2. Ikki bosqichli model — nega shunday

Contract §6.5(5) kechiktirilgan bajarishni **faqat o'chirish uchun** talab
qiladi. Rol tayinlash va sessiya bekor qilish darhol bajarilishi kerak
(buzilgan sessiyani 24 soatdan keyin bekor qilish ma'nosiz).

Shuning uchun "bekor qilish oynasi" **kechikish** sifatida emas,
**tasdiqning umri** sifatida modellandi:

```
request()  -> pending   (tasdiq 24 soat yashaydi)
pending    -> executed  (execute, TOTP qayta)
pending    -> cancelled (cancel)
pending    -> expired   (24 soat o'tsa, birinchi murojaatda)
```

Boshqa o'tish YO'Q. Bu oyna **o'lik skafolding emas** — hozirgi ikkala
amalda ham bekor qilish va eskirish real ishlaydi (testlar bilan
qulflangan). O'chirish sinfi qo'shilganda `executionDelayMs` registrda
24 soatga qo'yiladi — qayta loyihalash shart emas.

**Poyga xavfsizligi:** o'tishlar shartli `updateMany` bilan
(`where: { id, status: 'pending' }`). Ikki parallel `execute` da faqat
bittasi `count: 1` oladi. In-memory lock ishlatilmaydi (Contract A19).
Bajarish yiqilsa holat `pending` ga qaytariladi — amal "bajarilgan" bo'lib
qolmaydi.

## 3. Avtorizatsiya matritsasi

| Amal | OWNER | ADMIN | SUPPORT | MEMBER/VIEWER |
|---|:---:|:---:|:---:|:---:|
| Rol tayinlash | ✅ | ❌ | ❌ | ❌ |
| Sessiyalarni bekor qilish | ✅ | ❌ | ❌ | ❌ |

Ikki darvoza: controller `@Roles(OWNER)` **va** registrdagi `allowedRoles`
(servis ichida, bajarish/bekor qilishda ham qayta tekshiriladi). Global
`RolesGuard` bundan tashqari OWNER/ADMIN uchun 2FA talab qiladi.

**Invariantlar:** o'zini o'zgartirish taqiqlangan; oxirgi OWNER tushirilmaydi
(§6.7 bus factor); 2FA'siz foydalanuvchiga OWNER/ADMIN berilmaydi
(Konstitutsiya #10); rol atomik (`where: { role: previousRole }`) o'zgaradi,
ya'ni tasdiqdan keyin rol boshqa yo'l bilan o'zgargan bo'lsa eskirgan qaror
qo'llanmaydi.

## 4. TOTP — nega `verifyLogin` yetarli emas

`TwoFactorService.verifyLogin()` 2FA **o'chiq** bo'lsa `true` qaytaradi —
bu login uchun to'g'ri (2FA ixtiyoriy), lekin xavfli amal uchun xavfli
bo'lardi. Shuning uchun framework `twoFactorEnabled` bayrog'ini **alohida**
tekshiradi va faqat keyin mavjud servisga murojaat qiladi. Ikkinchi
autentifikatsiya mexanizmi yaratilmadi.

TOTP **ikki marta** so'raladi: so'rovda va bajarishda. Sabab: tasdiq 24 soat
yashaydi; bajarishda qayta-auth bo'lmasa, o'g'irlangan sessiya oyna ichida
tasdiqlangan amalni kodsiz ijro etardi.

## 5. Sessiya bekor qilish

Mavjud SEC-03 mexanizmi ishlatiladi: `tokenVersion` oshadi → `AuthGuard`
token payload'idagi `tv` bilan solishtiradi → mos kelmasa 401. Parallel
mexanizm yaratilmadi.

**Jonli tekshirildi:** haqiqiy token imzolandi, bekor qilingandan keyin
uning `tv` qiymati `User.tokenVersion` bilan mos kelmasligi tasdiqlandi.

Rol o'zgarganda ham `tokenVersion` oshiriladi — imtiyoz pasaytirilganda
darhol kuchga kirishi uchun.

## 6. OWNER Telegram signali — konfiguratsiya holati

Mavjud arxitektura qayta ishlatildi: `TelegramService.sendMessage`
(bot tokeni `TELEGRAM_BOT_TOKEN`, `render.yaml` da `sync: false`).
Yangi integratsiya yaratilmadi, kodda sir yo'q.

**Operator sozlamasi talab qilinadi:** `OWNER_ALERT_TELEGRAM_CHAT_ID` —
signal yuboriladigan kanal/guruh chat id. U infratuzilma sozlamasi
(foydalanuvchi ma'lumoti emas), shuning uchun env'da.

**Sozlanmagan holat jim yo'qolmaydi:** env bo'sh bo'lsa signal
`logger.error` bilan strukturaviy log sifatida yoziladi.

> **Jonli yetkazib berish TEKSHIRILMAGAN** — bu muhitda Telegram bot
> kredensiallari yo'q. Kod yo'li birlik-testlar bilan qoplangan; haqiqiy
> yetkazib berish operator env'ni to'ldirgach tasdiqlanishi kerak.

Signal xatosi xavfli amalni **to'xtatmaydi**: audit yozuvi (§6.5(4))
birlamchi, buzilmas dalil; Telegram — qulaylik qatlami.

## 7. `DELETE /users/me` — yakuniy xavfsizlik modeli

### Topilgan bo'shliq
Endpoint hech qanday qo'shimcha dalil so'ramasdan hisobni, balansni,
agentlarni va suhbatlarni yo'q qilardi — **o'g'irlangan sessiya** (OTP
fishing / SIM-swap) bir so'rovda hammasini yo'qota olardi.

### Nima uchun §6.5 oqimi TO'LIQ qo'llanmadi
§6.5 — **admin** xavfli amallari uchun (boshqa odam ustidan amal). O'z
hisobini o'chirish — foydalanuvchining **GDPR huquqi**. Shuning uchun:

| §6.5 qadami | Self-service'da | Sabab |
|---|:---:|---|
| Sabab (20 belgi) | ❌ | GDPR o'chirishni oqlashga majburlab bo'lmaydi |
| TOTP re-auth | ✅ | O'g'irlangan sessiya himoyasi — asosiy tahdid |
| Yozib tasdiqlash | ✅ | Tasodifiy/CSRF-uslub chaqiruvni to'sadi |
| 24 soat kechikish | ❌ | §6.5(5) buni faqat **admin** o'chirishi uchun belgilaydi |
| OWNER signali | ❌ | Admin nazorati uchun, o'z amali uchun emas |

### Yopilgan holat
`DELETE /users/me` endi talab qiladi: `confirmation = "DELETE <o'z-id>"`
(server hisoblaydi) **va** 2FA yoqilgan bo'lsa TOTP. 9 ta test bilan
qulflangan.

### OCHIQ QOLGAN: davomli o'chirish-yozuvi

Contract A15: *"GDPR hard-delete + `AuditLog` yozuvi yagona yo'l"*. Bugun
`auditLog.deleteMany({ actorId })` foydalanuvchining audit izini o'chiradi
va **`AuditLog.actorId` NON-NULL FK** bo'lgani uchun o'chirilgandan keyin
yozuv qoldirib bo'lmaydi. Ya'ni A15 ning "AuditLog yozuvi" qismi
bajarilmagan.

Baholangan variantlar:

| Variant | Baho |
|---|---|
| `actorId` nullable | Kanonik hash `actorId`ni qamraydi va zanjir **per-actor** — `null` aktor zanjirni buzadi. A17 ni qayta loyihalashni talab qiladi. **Rad etildi.** |
| **Tizim-aktori** (rezerv `User` qatori) | FK, hash va per-actor zanjir **o'zgarishsiz** qoladi; o'chirish yozuvi tizim aktori zanjirida yashaydi. **Tavsiya etiladi.** |
| Alohida jadval (FK'siz) | Audit zanjiridan tashqarida — buzilmaslik isboti yo'q. Rad etildi. |
| Tashqi jurnal | Infratuzilma yo'q (Phase 5). |

**Tanlangan yo'nalish:** tizim-aktori. **Bu birlikka KIRITILMADI** — u
rezerv `User` qatorini urug'lantirish, uni admin ro'yxatlari/sanoqlaridan
chiqarish va login yo'llarini yopishni talab qiladi, ya'ni o'z ijro
birligi. Topilma **yo'qolmadi**: shu yerda va `users.service.ts` izohida
aniq qayd etilgan.

## 8. Tekshiruv

**Jonli Postgres bilan tasdiqlangan** (mocklar isbotlay olmaydigan xulq):
token bekor qilinishi, audit zanjirining butunligi (`verifyChain` — 4 yozuv,
`ok: true`), `intent`/`result` juftliklari, takroriy bajarishning rad
etilishi, bekor qilishdan keyin bajarib bo'lmasligi.

Migratsiya: apply → rollback (jadval tashlandi, 19 user / 36 audit yozuvi
butun) → re-apply → `migrate status` toza.
