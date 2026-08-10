# SEC-14 — sir rotatsiyasi va gitleaks: audit va holat

**Sana:** 2026-08-10 · **Contract:** §7 SEC-14, A37/ADR-016
**Oldingi bosqich:** [`sec13-audit.md`](sec13-audit.md) (CSP + sarlavhalar)
**Runbook:** [`../runbooks/secret-rotation.md`](../runbooks/secret-rotation.md)

---

## 1. Boshlang'ich audit

Har topilma `grep`/DB so'rovi natijasi — taxmin emas.

### Nima shifrlangan (to'liq ro'yxat)

| Jadval.ustun | Tur | O'qish yo'li | Dev bazasida |
|---|---|---|---|
| `User.twoFactorSecret` | `String?` | `decryptString` (legacy-tolerant) | 1 qator |
| `User.twoFactorSecretPending` | `String?` | `decryptString` | 1 qator |
| `ConnectorConfig.config` | `Json?` | `decryptJson` (legacy-tolerant) | 0 qator |
| `BrowserSession.state` | `String` | `decryptJson` | 0 qator |
| `CallRecording.data` | `String` | `decrypt` (QAT'IY) | 1 qator |

`BrowserSession.state` uchun bugun **yozuvchi kod yo'q** — headful
`LoginCapture` Contract A22 bo'yicha olib tashlangan. Ustun o'qish yo'lida
qoladi, shuning uchun rotatsiya registriga baribir kiritildi.

### Audit savollariga javob

| Savol | Javob |
|---|---|
| Shifrmatn tuzilishi | `v1:<iv_b64>:<tag_b64>:<ct_b64>`, AES-256-GCM, 12-baytli IV |
| Kalit qayerdan | `CryptoService` konstruktori, `process.env.ENCRYPTION_KEY` |
| Kalit derivatsiyasi | 64-hex → xom 32 bayt; aks holda `sha256(raw)` |
| Eskini yangidan ajratib bo'ladimi | HA — versiya prefiksi allaqachon bor edi |
| Yarim rotatsiya | Ikkala kalit yuklangani uchun baza TO'LIQ o'qiladi |
| Noto'g'ri yangi kalit | GCM auth yiqiladi → skript yozishdan OLDIN to'xtaydi |
| Rollback | Env'ni almashtirib teskari rotatsiya (lokal bazada sinaldi) |
| Tugaganini bilish | `--verify` → `stale = 0`, `rotationComplete = true` |

### Mavjud sarlavha/CI holati

- CI'da sir skaneri **YO'Q** edi.
- Haqiqiy `.env` fayllari `.gitignore` da; git'da faqat `.env.example`.
- `crypto.service.spec.ts` da 64-hex test kaliti **kodda yozilgan** edi.

---

## 2. Shifrlash arxitekturasi — OLDIN

```
ENCRYPTION_KEY → sha256/hex → 32 bayt → BITTA kalit
yozish:  v1:<iv>:<tag>:<ct>
o'qish:  parts[0] === 'v1' bo'lishi SHART, aks holda xato
isEncrypted(v) = v.startsWith('v1:')
```

Rotatsiya **imkonsiz** edi: kalit almashtirilsa eski shifrmatn butunlay
o'qilmay qolardi (bir vaqtda ikkinchi kalitni yuklash yo'li yo'q).

## 3. Shifrlash arxitekturasi — KEYIN

```
ENCRYPTION_KEY                  + ENCRYPTION_KEY_VERSION          (default v1)
ENCRYPTION_KEY_PREVIOUS         + ENCRYPTION_KEY_PREVIOUS_VERSION (ixtiyoriy)
                     ↓
        keyring: Map<versiya, kalit>
                     ↓
yozish:  HAR DOIM joriy versiya
o'qish:  versiya → ANIQ kalit (Map lookup)
```

**Algoritm o'zgarmadi** (AES-256-GCM), **derivatsiya o'zgarmadi**,
**ikkinchi kripto implementatsiyasi yaratilmadi**.

## 4. Kalit versiyalash dizayni

**Versiya = KALIT AVLODI, algoritm emas.** Prefiks qaysi kalit kerakligini
BIR MA'NODA aytadi.

**"Bir nechta kalitni navbat bilan sinash" ATAYLAB RAD ETILDI:** u
kalit-chalkashligiga yo'l ochardi va "qaysi kalit ishladi" degan savolni
auditlab bo'lmasdi. Har shifrmatn uchun aynan BITTA kalit sinaladi.

Konfiguratsiya invariantlari (boot'da majburlanadi):
- `ENCRYPTION_KEY_PREVIOUS` va `..._PREVIOUS_VERSION` — **birga** yoki
  **umuman yo'q** (yarim konfiguratsiya = boot xatosi);
- oldingi versiya joriy bilan **bir xil bo'lolmaydi**;
- versiya formati `v<raqam>`.

**Orqaga-moslik:** default versiya `v1` — mavjud `.env`, mavjud Render
konfiguratsiyasi va mavjud ma'lumot **hech qanday o'zgarishsiz** ishlaydi.

### Tuzatilgan jimgina xavf

`isEncrypted()` ilgari `startsWith('v1:')` edi. Versiyalar qo'shilgach bu
metod `v2:` blobni **plaintext deb** hisoblardi va `decryptString`/
`decryptJson` uni **shifrmatn holida "sir" sifatida qaytarardi**. Endi
tekshiruv faqat SHAKLGA qaraydi (kalitga emas), noma'lum versiya esa
`decrypt`da ANIQ xato beradi (fail-closed). Test bilan qulflangan.

## 5. Rotatsiya algoritmi

`apps/api/scripts/rotate-encryption-key.mjs` — shifrlash mantig'ini
`dist/crypto/crypto.service.js` dan **import qiladi** (nusxalamaydi;
`audit-rechain.mjs` bilan bir xil naqsh).

```
kalit konfiguratsiyasini tekshirish   → xato bo'lsa: strukturaviy abort, 0 yozuv
joriy kalit round-trip probe          → xato bo'lsa: abort
har jadval/ustun bo'yicha batch (200) →
   tasnif: current | stale | plaintext | empty
   current   → TEGILMAYDI (idempotentlik)
   stale     → decrypt(eski kalit) → encrypt(joriy) → SHARTLI UPDATE → qayta o'qib tasdiqlash
   plaintext → sanaladi + hisobotda ko'rinadi (jim o'tkazilmaydi)
   o'qilmadi → `unreadable` + yozuv id'si hisobotda, exit != 0
yakuniy summary + rotationComplete
```

- **Shartli UPDATE** (`where: { id, ustun: eskiQiymat }`, `count === 1`) —
  parallel yozuvchi ustidan yozilmaydi;
- **yozgandan keyin darhol qayta o'qib** tasdiqlanadi;
- **`--verify`** rejimi (default) hech narsa yozmaydi, lekin eski kalit
  yozuvlarni ocha olishini ISBOTLAYDI;
- **`--encrypt-plaintext`** — legacy shifrlanmagan yozuvlarni ataylab
  shifrlash (default emas).

## 6. Nosozlik xavfsizligi (jonli sinov)

Lokal Postgres + haqiqiy kripto, 3 ta haqiqiy shifrlangan yozuvda.
Kontent saqlangani **sha256 barmoq izlari** bilan isbotlandi (ochiq matn
hech qayerga chiqmasdan).

| Holat | Kutilgan | Natija |
|---|---|---|
| A: ikkala kalit to'g'ri | rotatsiya muvaffaqiyatli | ✅ 3/3 → v2, `rotationComplete` |
| B: ESKI kalit noto'g'ri | ma'lumot tegilmaydi | ✅ exit 1, `unreadable=3`, 0 yozuv |
| C: YANGI kalit yaroqsiz | yozishdan oldin abort | ✅ exit 1, ma'lumot v1 holida |
| D: buzilgan shifrmatn | ANIQ hisobot, jim o'tkazilmaydi | ✅ `unreadable` + id |
| E: yarim rotatsiya | baza to'liq o'qiladi | ✅ (unit test + ikki kalitli boot) |
| F: ikki marta ishga tushirish | ikkinchisi buzmaydi | ✅ `rotated=0, current=3` |
| G: rotatsiyadan keyin eski kalit | xavfsiz yiqiladi | ✅ |
| H: buzilgan tag | GCM auth xatosi | ✅ |
| Rollback | asl holatga qaytish | ✅ kontent butun, v1 ga qaytdi |
| Sir sizishi | chiqishda kalit yo'q | ✅ |

**Jami: 11/11 jonli tekshiruv.** Mashq skripti vaqtinchalik edi va
commit qilinmadi; dev bazasi **asl holatiga** qaytarildi (3 yozuv, `v1`).

## 7. Observability

Strukturaviy JSON loglar: `rotation.start`, `target.done`,
`rotation.summary`, `rotation.problems`, `rotation.abort`,
`rotation.error`.

Chiqadi: sanoqlar, versiya teglari, muammoli yozuv **id** lari, mexanik
xato sababi. **Chiqmaydi:** kalit, ochiq matn, shifrmatn qiymati.
`CryptoService.keyringStatus()` ham faqat versiya teglarini qaytaradi
(test bilan qulflangan).

## 8. Kalit validatsiyasi

| Holat | Xulq |
|---|---|
| Prod, kalit yo'q | boot TO'XTAYDI (mavjud xulq saqlandi) |
| Prod, kalit < 32 belgi | boot TO'XTAYDI (**yangi**) — xato matnida kalit YO'Q |
| Prod, Render `generateValue` uslubidagi uzun kalit | QABUL qilinadi |
| Dev, kalit yo'q | barqaror dev derivativ kalit + ogohlantirish |

**Derivatsiya ATAYLAB o'zgartirilmadi.** Qat'iy 64-hex talab qilish jonli
prod kalitini (Render `generateValue`, hex emas) yaroqsiz qilardi va
mavjud ma'lumotni o'qib bo'lmasdi. Uzunlik gate'i xuddi shu maqsadga
(zaif kalitni to'sish) ma'lumotni buzmasdan erishadi.

**Qo'shimcha topilma:** `INTERNAL_API_TOKEN` ning dev fallback qiymati
(`agentnet-internal-dev`) kodda ham, `.env.example` da ham ochiq turadi.
`validateEnv()` faqat "mavjudmi" deb tekshirardi — ya'ni o'sha OMMAVIY
qiymat prod'da qolib ketsa, "ichki server-to-server" darvozasi amalda
ochiq bo'lardi. Endi prod boot'da rad etiladi (qiymatning o'zi logga
yozilmaydi).

## 9. Gitleaks

- **Qoidalar:** rasmiy default to'plam (`useDefault = true`) — provayder
  formatlari yuqori oqimda kuzatiladi. O'z qoidalarimiz yozilmadi.
- **CI ishi:** `secrets` — har push/PR'da, **shartsiz**, `--exit-code 1`
  (bloklovchi), `--redact` (topilma CI logiga CHIQMAYDI), versiya
  **qotirilgan** (`8.21.2`).
- **Tarix skani:** alohida `secrets-history` ishi, `workflow_dispatch`
  bilan. **Ataylab bloklovchi emas:** tarixdagi topilma kodni tuzatish
  bilan hal bo'lmaydi — u insident (kalitni bekor qilish + tarixni qayta
  yozish), ya'ni operator qarori. Har PR'ni bloklash shoshilinch
  "allowlist"ga bosim yaratardi — aynan SEC-14 oldini olmoqchi bo'lgan narsa.

### Allowlist (5 ta, hammasi tekshirilgan)

| Qiymat | Nima | Nega sir emas |
|---|---|---|
| `sk-ant-...` | `.env.example`, hujjat | to'ldiruvchi; haqiqiy kalit `sk-ant-api03-<88>` |
| `sk-ant-placeholder` | CI env | to'ldiruvchi |
| `ABCDEFGHIJKLMNOPQRSTUVWXYZ234567` | base32 alifbosi (RFC 4648) | juftlash kodi generatori |
| `agentnet-dev-encryption-key-do-not-use-in-prod` | dev urug'i | ochiq kodda turishi ataylab; prod'da kalit majburiy |
| `a-strong-random-secret-64hex-(etc\|XXX)` | test yorlig'i | entropiyasi past soxta qiymat |

`paths` faqat generatsiya qilinadigan artefaktlar uchun
(`node_modules`, `.next`, `dist`, `.venv`, `package-lock.json`).
**Bironta MANBA fayli/papkasi ochilmagan** — test buni bloklaydi.

**Repodan olib tashlandi:** `crypto.service.spec.ts` dagi qattiq kodlangan
64-hex test kaliti — endi test ichida generatsiya qilinadi.

## 10. Testlar

| To'plam | Testlar | Nima qulflanadi |
|---|---|---|
| `crypto/key-rotation.spec.ts` (yangi) | 23 | versiyalash, v1/v2 moslik, aralash baza, uzilgan rotatsiya, noto'g'ri/buzilgan kalit, versiya-almashtirish, idempotentlik, prod validatsiya |
| `common/gitleaks-config.spec.ts` (yangi) | 12 | skaner bloklovchi, `--redact`, versiya qotirilgan, allowlist intizomi |
| `crypto/crypto.service.spec.ts` | 9 | mavjud xulq (o'zgarmadi) |
| `common/validate-env.spec.ts` | 8 (+4) | ommaviy dev qiymati prod'da rad etiladi |

**HAQIQIY kripto ishlatiladi** — `CryptoService` mock qilinmagan.

**Bazaviy → yakuniy:** 57 to'plam / 687 test → **59 to'plam / 727 test**.

## 11. Buildlar va migratsiya

| Tekshiruv | Natija |
|---|---|
| `prisma validate` | ✅ |
| `tsc --noEmit` (api) | ✅ |
| `tsc --noEmit` (web) | ✅ |
| `eslint` (api) | ✅ 0 xato |
| `eslint` (web) | ✅ 0 xato |
| `jest` | ✅ 59 / 727 |
| `nest build` | ✅ |
| `next build` | ✅ |
| `prisma migrate status` | ✅ toza (33 migratsiya) |
| **Haqiqiy boot** (oddiy) | ✅ `/api/health` 200 |
| **Haqiqiy boot** (rotatsiya rejimi, 2 kalit) | ✅ 200, `yozish=v2, o'qish=[v2, v1]`, 0 xato |

**Migratsiya YO'Q va KERAK EMAS.** Shifrmatn **o'z-o'zini tavsiflaydi**
(versiya prefiksi qiymatning ichida) — versiya uchun yangi ustun kerak
emas. Kosmetik migratsiya kiritilmadi (§28 qoidasi).

## 12. Xavfsizlik ko'rigi

| Qidirilgan | Natija |
|---|---|
| Ochiq matn/kalit chiqishi | yo'q — jonli mashqda tasdiqlandi |
| Kalit log/xato matnida | yo'q — testlar bilan qulflangan |
| Xavfsiz bo'lmagan fallback | yo'q — noma'lum versiya = xato (plaintext EMAS) |
| Downgrade yo'li | yo'q — bitta algoritm, versiya faqat kalitni tanlaydi |
| Kalit chalkashligi | yo'q — Map lookup, "sinab ko'rish" yo'q |
| Maxsus yasalgan shifrmatn kalitni tanlay oladimi | Prefiks kalitni tanlaydi, LEKIN har ikkala kalit ham GCM bilan autentifikatsiya qiladi — soxta blob ikkalasida ham yiqiladi. Versiya almashtirish testi buni qulflaydi |
| Yarim rotatsiya buzilishi | yo'q — shartli UPDATE + idempotentlik |
| Poyga | shartli UPDATE `count === 1` talab qiladi |
| Noto'g'ri versiya aniqlash | fail-closed |
| Prod'da xavfsiz bo'lmagan default | tuzatildi (`INTERNAL_API_TOKEN`) |

## 13. Qolgan risklar

1. **Gitleaks LOKAL ISHGA TUSHIRILMADI** — bu muhitda tarmoq (GitHub
   releases) va docker yo'q. Holat aniq ajratilgan:
   - *kod tekshirildi*: `.gitleaks.toml` TOML sifatida, CI YAML YAML
     sifatida parse qilindi; konfiguratsiya testlar bilan qulflandi;
   - *lokal tekshirilmadi*: skanerning haqiqiy natijasi;
   - *muhitga bog'liq*: birinchi CI ishga tushishida tasdiqlanadi.
   Allowlist qo'lda skan natijasiga asoslangan (taxminga emas), lekin
   birinchi CI qizil bo'lsa, topilmalarni ko'rib chiqish kerak.
2. **Prod rotatsiyasi PROD'DA BAJARILMADI** — prod kredensiallari yo'q.
   Mexanizm lokal Postgres'da jonli sinaldi (11/11), prod'da esa runbook
   bo'yicha operator bajaradi. **Bu "production-verified" DEB DA'VO
   QILINMAYDI.**
3. **Backup nomuvofiqligi** — rotatsiyagacha olingan DB backup'lari eski
   kalit bilan shifrlangan. Runbook 9-qadam eski kalitni backup saqlash
   muddati tugagunicha saqlashni talab qiladi.
4. **`--encrypt-plaintext` default emas** — legacy shifrlanmagan yozuvlar
   (agar bo'lsa) hisobotda ko'rinadi, lekin avtomatik shifrlanmaydi.
   Ataylab: bu ma'lumot o'zgarishi, operator qarori.
5. **Kalit menejeri yo'q** — kalitlar Render env'da (Contract A37/ADR-016
   bo'yicha KEEP). Vault/KMS kiritilmadi.

## 14. Operatsion talablar

- Rotatsiyani **operator** bajaradi (runbook 15-bo'lim cheklisti).
- Rotatsiya davomida **maintenance rejimi SHART EMAS** — ikkala kalit ham
  yuklangani uchun xizmat to'xtamaydi (ikki kalitli boot tasdiqlandi).
- `apps/api` **build qilingan** bo'lishi shart (skript `dist/` dan o'qiydi).
- Eski kalit **`--verify` toza bo'lmaguncha** o'chirilmaydi.

## 15. O'zgargan fayllar

**API:** `src/crypto/crypto.service.ts` · `src/common/validate-env.ts` ·
`scripts/rotate-encryption-key.mjs` (yangi)

**Testlar:** `src/crypto/key-rotation.spec.ts` (yangi) ·
`src/common/gitleaks-config.spec.ts` (yangi) ·
`src/crypto/crypto.service.spec.ts` (qattiq kodlangan kalit olib tashlandi) ·
`src/common/validate-env.spec.ts`

**Konfiguratsiya:** `.gitleaks.toml` (yangi) · `.github/workflows/ci.yml` ·
`.env.example`

**Hujjat:** `docs/runbooks/secret-rotation.md` (yangi) ·
`docs/status/sec14-audit.md` (shu fayl)

## 16. Keyingi vazifa

**SEC-15 — Bog'liqlik xavfsizligi** (Contract §7): CI'da bloklovchi
`npm audit --omit=dev --audit-level=high`, engine uchun `pip-audit`,
Dependabot/Snyk haftalik PR. **Boshlanmagan.**
