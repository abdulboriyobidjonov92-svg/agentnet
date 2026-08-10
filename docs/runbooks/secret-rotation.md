# Runbook — `ENCRYPTION_KEY` rotatsiyasi (SEC-14)

**Kimga:** operator/dežurniy muhandis. Kodni yozgan bo'lishingiz SHART EMAS.
**Nima qiladi:** DB'dagi shifrlangan maydonlarni ESKI kalitdan YANGI kalitga
ko'chiradi, ma'lumotni yo'qotmasdan va xizmatni to'xtatmasdan.
**Vaqt:** ~15 daqiqa (bugungi ma'lumot hajmida sekundlar).

> **ENG MUHIM QOIDA:** eski kalitni `--verify` "toza" deb aytmaguncha
> **HECH QACHON** o'chirmang. Eski kalit yo'qolsa, eski shifrmatn
> **butunlay tiklanmaydi**.

---

## 0. Nima shifrlangan

| Jadval.ustun | Nima |
|---|---|
| `User.twoFactorSecret` | 2FA TOTP siri |
| `User.twoFactorSecretPending` | tasdiqlanmagan 2FA siri |
| `ConnectorConfig.config` | konnektor tokenlari (Telegram/WhatsApp/SMS/SMTP/CRM) |
| `BrowserSession.state` | brauzer sessiya cookie'lari |
| `CallRecording.data` | qo'ng'iroq yozuvi (audio) |

Shifrmatn formati: `<versiya>:<iv>:<tag>:<ct>` — AES-256-GCM.
**Versiya = KALIT AVLODI**, algoritm emas. Ya'ni prefiks qaysi kalit
kerakligini bir ma'noda aytadi.

---

## 1. Qachon rotatsiya kerak

- Kalit sizib chiqqan yoki sizishiga **shubha** bor (insidentda — DARHOL);
- xodim ketdi va kalitga kirish huquqi bor edi;
- muntazam jadval bo'yicha (tavsiya: **yiliga bir marta**);
- compliance (SOC2/ISO) talab qilsa.

---

## 2. Oldindan shartlar

- [ ] Render (yoki boshqa muhit) env'iga yozish huquqi bor;
- [ ] DB'ning **yangi zaxira nusxasi** olingan va tiklanishi tekshirilgan;
- [ ] `apps/api` build qilingan (`npm run build` — skript `dist/` dan o'qiydi);
- [ ] `DATABASE_URL` shu muhitning bazasiga qarab turibdi;
- [ ] parol-menejerda ESKI kalit saqlangan (rollback uchun kerak bo'ladi);
- [ ] boshqa deploy/migratsiya ayni paytda ketmayapti.

---

## 3. Yangi kalit yaratish

```bash
openssl rand -hex 32
```

- 64 ta hex belgi = 32 bayt = AES-256.
- Kalitni **parol-menejerga** joylang (nomi: `AgentNet ENCRYPTION_KEY v2`, sana bilan).
- Terminal tarixini tozalang: `history -c` (yoki buyruq oldiga bo'sh joy qo'ying).
- Kalitni Slack/Telegram/email/tiket'ga **YOZMANG**.

---

## 4. Rotatsiya rejimini yoqish

Muhit o'zgaruvchilariga (Render → servis → Environment) **to'rttasini** qo'ying:

```
ENCRYPTION_KEY=<YANGI kalit>
ENCRYPTION_KEY_VERSION=v2
ENCRYPTION_KEY_PREVIOUS=<ESKI kalit>
ENCRYPTION_KEY_PREVIOUS_VERSION=v1
```

> Agar ilgari ham rotatsiya bo'lgan bo'lsa, versiyani OSHIRING (v2 → v3).
> Joriy versiyani bilish uchun: 5-qadamdagi `readableVersions` maydoni.

**Nima bo'ladi:** ilova ikkala kalitni ham yuklaydi — eski yozuvlar (v1) va
yangi yozuvlar (v2) **bir vaqtda o'qiladi**. Yangi yozuvlar v2 da yoziladi.
Xizmat to'xtamaydi, maintenance rejimi SHART EMAS.

Servisni qayta deploy qiling (env o'zgarishi restart talab qiladi).

---

## 5. Tekshiruv (yozmaydi)

```bash
cd apps/api
node scripts/rotate-encryption-key.mjs --verify
```

Kutilgan chiqish (JSON qatorlar):

```json
{"event":"rotation.start","mode":"verify","writeVersion":"v2","readableVersions":["v2","v1"]}
{"event":"rotation.summary","mode":"verify","discovered":N,"stale":M,"unreadable":0,"failed":0}
```

| Belgi | Ma'nosi | Nima qilish |
|---|---|---|
| `unreadable > 0` | ESKI kalit noto'g'ri yoki yozuv buzilgan | **TO'XTANG** → 11-bo'lim |
| `readableVersions` da 1 ta versiya | oldingi kalit sozlanmagan | 4-qadamni qayta tekshiring |
| `stale = 0` | ko'chiriladigan yozuv yo'q | rotatsiya shart emas |
| `failed = 0`, `stale = M` | hammasi joyida | 6-qadamga o'ting |

---

## 6. Rotatsiyani bajarish

```bash
node scripts/rotate-encryption-key.mjs --apply
```

Skript: har yozuvni eski kalit bilan ochadi → yangi kalit bilan yopadi →
**shartli** UPDATE qiladi (parallel yozuvchi ustidan yozmaydi) → darhol
qayta o'qib tasdiqlaydi.

**Uzilib qolsa xavfsiz:** shunchaki qaytadan ishga tushiring. Skript
**idempotent** — allaqachon v2 bo'lgan yozuvlarga tegmaydi.

---

## 7. Natijani tasdiqlash

```bash
node scripts/rotate-encryption-key.mjs --verify
```

Talab: `stale = 0`, `unreadable = 0`, `failed = 0`, `rotationComplete = true`.

Qo'shimcha (tavsiya etiladi):
- [ ] test hisobi bilan login → 2FA kodi qabul qilinadimi;
- [ ] konnektor sahifasi ochiladimi va "connected" holatini ko'rsatadimi;
- [ ] `/api/health` 200 qaytaradimi.

---

## 8. Yangi konfiguratsiyani qoldirish

Bu bosqichda hech narsa o'zgartirilmaydi — ilova allaqachon yangi kalit
bilan yozmoqda. Bir necha soat/kun kuzatib turing (xato loglari, foydalanuvchi
shikoyatlari).

---

## 9. Eski kalitni olib tashlash

**FAQAT 7-qadam toza bo'lgandan keyin.**

Env'dan ikkita qatorni o'chiring:

```
ENCRYPTION_KEY_PREVIOUS
ENCRYPTION_KEY_PREVIOUS_VERSION
```

Qayta deploy qiling va yana bir marta:

```bash
node scripts/rotate-encryption-key.mjs --verify   # stale = 0 bo'lishi SHART
```

Eski kalitni parol-menejerda **kamida 30 kun** saqlang (zaxira nusxalar hali
eski kalit bilan shifrlangan!), so'ng o'chiring.

> **Zaxira nusxalar haqida:** 9-qadamdan OLDIN olingan DB backup'lari
> **ESKI** kalit bilan shifrlangan. Ularni tiklash uchun eski kalit
> kerak bo'ladi. Shuning uchun backup saqlash muddati tugamaguncha
> eski kalitni yo'q qilmang.

---

## 10. Rollback (orqaga qaytarish)

Rotatsiya davomida yoki keyin muammo chiqsa:

**A) Eski kalit HALI env'da bo'lsa (9-qadam bajarilmagan):**
Env'ni almashtiring — eski kalitni JORIY, yangisini OLDINGI qiling:

```
ENCRYPTION_KEY=<ESKI kalit>
ENCRYPTION_KEY_VERSION=v1
ENCRYPTION_KEY_PREVIOUS=<YANGI kalit>
ENCRYPTION_KEY_PREVIOUS_VERSION=v2
```

So'ng `node scripts/rotate-encryption-key.mjs --apply` — barcha yozuvlar
v1 ga qaytadi. (Bu yo'l lokal bazada sinovdan o'tgan.)

**B) Eski kalit allaqachon o'chirilgan bo'lsa:**
Kod bilan tiklab bo'lmaydi. Yagona yo'l — DB backup'idan tiklash (u eski
kalit bilan shifrlangan) → 11-bo'lim.

---

## 11. Rotatsiya muvaffaqiyatsiz bo'lsa

`unreadable > 0` yoki `failed > 0`:

1. **To'xtang.** Skript hech qanday yozuvni buzmaydi — muvaffaqiyatsizlar
   eski holatida qoladi, ilova ularni eski kalit bilan o'qiyveradi.
2. `rotation.problems` qatoridan yozuv `id` larini oling (u yerda **faqat
   id**, hech qanday sir yo'q).
3. Sababni aniqlang:
   - `decrypt: ...` — eski kalit noto'g'ri **yoki** yozuv haqiqatan buzilgan;
   - `yozuv bu orada o'zgargan` — parallel yozuv; shunchaki qayta ishga tushiring;
   - `plaintext` — yozuv umuman shifrlanmagan (eski, migratsiyagacha bo'lgan
     ma'lumot). Ataylab shifrlash uchun: `--apply --encrypt-plaintext`.
4. Eski kalit to'g'riligiga ishonchingiz komil bo'lsa va yozuv baribir
   ochilmasa — o'sha yozuv buzilgan. Uni tiklash uchun backup kerak.
5. Env'ni **o'zgarishsiz qoldiring** (ikkala kalit ham joyida) va muhandisga
   murojaat qiling.

---

## 12. Insidentga javob (kalit sizib chiqdi)

1. **Darhol** yangi kalit yarating (3-qadam) va rotatsiyani bajaring (4–7).
2. Sizib chiqqan kalit bilan shifrlangan **barcha sirlarni ham** almashtirilgan
   deb hisoblang: konnektor tokenlarini (Telegram bot, SMS, SMTP) qayta
   yarating, foydalanuvchilardan 2FA'ni qayta sozlashni so'rang.
3. `AUTH_JWT_SECRET` ham sizgan bo'lishi mumkin bo'lsa — uni ham almashtiring
   (barcha foydalanuvchilar tizimdan chiqadi, bu kutilgan).
4. Audit jurnalini ko'ring (`/admin/audit`) — g'ayrioddiy faollik bormi.
5. Hodisani hujjatlashtiring (sana, ta'sir doirasi, ko'rilgan choralar).

---

## 13. Qaysi loglarga qarash kerak

| Manba | Nimani ko'rsatadi |
|---|---|
| `rotation.start` | rejim, yozish versiyasi, o'qiladigan versiyalar |
| `target.done` | har jadval bo'yicha sanoq |
| `rotation.summary` | yakuniy sanoq + `rotationComplete` |
| `rotation.problems` | muammoli yozuv `id` lari va mexanik sabab |
| API boot logi | `Kalit rotatsiyasi rejimi: yozish=..., o'qish=[...]` |

---

## 14. HECH QACHON loglanmaydi / yozilmaydi

- ❌ kalitning o'zi (eski yoki yangi), hatto qisman ham;
- ❌ deshifrlangan sir (TOTP, token, cookie, audio);
- ❌ shifrmatnning to'liq qiymati;
- ❌ kalit tiket/PR/Slack/commit xabarida;
- ❌ kalit skrinshotda.

Skript va `CryptoService` buni kod darajasida kafolatlaydi (testlar bilan
qulflangan), lekin **qo'lda** buyruq yozganda ehtiyot bo'ling:
`echo $ENCRYPTION_KEY` — qilmang.

---

## 15. Operator cheklisti

- [ ] DB backup olindi va tiklanishi tekshirildi
- [ ] Yangi kalit `openssl rand -hex 32` bilan yaratildi
- [ ] Kalit parol-menejerga joylandi
- [ ] To'rtta env qo'yildi, servis qayta deploy qilindi
- [ ] `--verify`: `unreadable = 0`
- [ ] `--apply` bajarildi
- [ ] `--verify`: `stale = 0`, `rotationComplete = true`
- [ ] Login + 2FA + konnektor qo'lda tekshirildi
- [ ] Kuzatuv oynasi o'tdi (bir necha soat/kun)
- [ ] `ENCRYPTION_KEY_PREVIOUS*` olib tashlandi, qayta deploy
- [ ] Yakuniy `--verify` toza
- [ ] Eski kalit backup muddati tugagach o'chiriladi (kalendarga qo'yildi)

---

## 16. Sir skaneri (gitleaks)

CI har push/PR'da ishchi daraxtni skanlaydi (`secrets` ishi, **bloklovchi**).
Topilma bo'lsa CI qizaradi va **qiymat logga chiqmaydi** (`--redact`).

Tarix bo'yicha to'liq skan — GitHub → Actions → CI → *Run workflow*
(`secrets-history` ishi). U ataylab bloklovchi emas: tarixdagi topilma
kodni tuzatish bilan hal bo'lmaydi, u **insident** (kalitni bekor qilish +
tarixni qayta yozish).

Tarixda haqiqiy sir topilsa:
1. sirni **darhol bekor qiling** (bu birinchi qadam, tarixni tozalash emas);
2. shu runbook bo'yicha rotatsiya qiling;
3. tarixni tozalashni (`git filter-repo`) alohida rejalashtiring.

Noto'g'ri topilma (false positive) bo'lsa — `.gitleaks.toml` ga **aniq
qiymat yoki tor regex** qo'shing va sababini izohda yozing. **Butun
fayl/papkani ochib qo'yish taqiqlanadi** (test buni bloklaydi).
