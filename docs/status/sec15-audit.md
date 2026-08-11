# SEC-15 — bog'liqlik xavfsizligi: audit va holat

**Sana:** 2026-08-11 · **Contract:** §7 SEC-15
**Oldingi bosqich:** [`sec14-audit.md`](sec14-audit.md) (sir rotatsiyasi + gitleaks)

**HOLAT: QISMAN — vosita qatlami TAYYOR, npm remediatsiyasi BLOKLANGAN.**
Batafsil: §7 va §11.

---

## 1. O'zgargan fayllar

| Fayl | O'zgarish |
|---|---|
| `.github/workflows/ci.yml` | `npm-audit` va `pip-audit` ishlari (ikkalasi BLOKLOVCHI) + `PIP_AUDIT_VERSION` |
| `.github/dependabot.yml` | **yangi** — haftalik npm/pip/actions kuzatuvi |
| `apps/agent-engine/requirements.txt` | `cryptography>=50.0.0` xavfsizlik poli |
| `apps/api/src/common/dependency-security.spec.ts` | **yangi** — 19 ta konfiguratsiya testi |
| `docs/status/sec15-audit.md` | **yangi** — shu hujjat |

**O'ZGARMAGAN (ataylab):** `package.json`, `package-lock.json`,
`apps/*/package.json`. Sabab §7 da.

---

## 2. Bog'liqlik xavfsizligi arxitekturasi

```
                    ┌─────────────────────────────────────┐
   har push/PR ───► │ CI: npm-audit  (prod, high gate)    │ BLOKLOVCHI
                    │ CI: pip-audit  (engine requirements)│ BLOKLOVCHI
                    │ CI: secrets    (gitleaks, SEC-14)   │ BLOKLOVCHI
                    └─────────────────────────────────────┘
   har dushanba ──► Dependabot ──► PR ──► O'SHA CI'dan o'tadi
```

Yangi pipeline yaratilmadi: Dependabot PR'lari mavjud `ci.yml` ning
`pull_request` triggeriga tushadi, ya'ni har bog'liqlik PR'i avtomatik
ravishda audit + test + typecheck + lint + build dan o'tadi.

---

## 3. npm audit konfiguratsiyasi

```yaml
npm audit --omit=dev --audit-level=high     # BLOKLOVCHI
npm audit --omit=dev || true                # hisobot (moderate/low ko'rinadi)
```

- **`--omit=dev`** — faqat prod bog'liqliklari. Dev-only zaiflik (jest,
  eslint, turbo) jonli xizmatga chiqmaydi; uni bloklovchi qilish signalni
  shovqinga ko'mib, "e'tiborsiz qoldirish madaniyati"ni yaratardi.
- **`--audit-level=high`** — high/critical qizartiradi (Contract AC).
- **Ikkinchi, bloklamaydigan qadam** moderate/low ni ham CHIQARADI —
  ya'ni "faqat high" gate'i past darajali zaifliklarni YASHIRMAYDI.
- `npm ci` ataylab ishlatilmaydi: `npm audit` lockfile'ni o'qiydi,
  daraxtni o'rnatish shart emas — natija `node_modules` holatidan mustaqil.

## 4. pip-audit konfiguratsiyasi

```yaml
pip install pip-audit==2.10.1
pip-audit -r requirements.txt --progress-spinner off   # BLOKLOVCHI
```

- Versiya **qotirilgan** (yuqori oqim xulqi jimgina o'zgarmasin).
- `requirements.txt` — engine prod'da AYNAN shuni o'rnatadi.
  `requirements-camera.txt` (og'ir CV: torch/opencv/ultralytics, ~1-2GB)
  ataylab TASHQARIDA: u bazaviy o'rnatishga kirmaydi va `main.py`
  camera_router'ni himoyalangan import qiladi (H4/M5). Uni auditga
  qo'shish CI'ga 1-2GB o'rnatish qo'shardi, holbuki u prod'da yo'q.
- **MUHIM CHEKLOV:** `pip-audit` da `--audit-level` EKVIVALENTI YO'Q — u
  jiddiylik bo'yicha filtrlay olmaydi. Shuning uchun bu ish **HAR QANDAY**
  topilmada qizaradi, ya'ni talab qilinganidan QAT'IYROQ. Bu ongli tanlov:
  soxta "high-only" filtr yasab, jiddiyligi noma'lum topilmani jimgina
  o'tkazib yuborishdan ko'ra qat'iyroq bo'lish afzal.

## 5. Dependabot konfiguratsiyasi

| Ekotizim | Papka | Jadval |
|---|---|---|
| npm | `/` (yagona lockfile) | haftalik, dushanba 06:00 Asia/Tashkent |
| pip | `/apps/agent-engine` | haftalik |
| github-actions | `/` | haftalik |

- **Snyk QO'SHILMADI** — repo'da u umuman ishlatilmagan (`.snyk` yo'q,
  CI'da qadam yo'q). Ikkinchi vosita yangi hisob, token va ikkinchi
  hisobot yuzasini keltirardi. Contract "Dependabot/Snyk" deydi — bittasi
  yetarli. Test buni qulflaydi.
- **npm faqat ILDIZDAN** kuzatiladi: monorepo'da bitta `package-lock.json`
  bor; har workspace uchun alohida yozuv bir xil faylga tegadigan
  ziddiyatli PR'lar yaratardi.
- **Guruhlar:** `security-updates` alohida va birinchi; oddiy
  patch/minor bitta PR'da (haftada 20 ta PR emas).
- **MAJOR versiya PR'lari o'chirilgan** — Nest 11 / Next 16 kabi sakrashlar
  arxitektura qarori (ADR talab qiladi), Dependabot ularni migratsiya
  rejasisiz taklif qilardi. **Xavfsizlik yangilanishlari bu qoidadan
  MUSTASNO** (`security-updates` guruhi ularni baribir ochadi).

## 6. Siyosat (vulnerability topilganda)

1. **Avval mavjud yangilanish yo'lini tekshir** — `npm audit --json` /
   `pip-audit` chiqishidagi `fixAvailable` va advisory diapazoni.
2. **Minimal xavfsiz ko'tarish** — patch/minor birinchi navbatda. Agar
   `npm audit` "major kerak" desa, avval tranzitiv paketning O'ZI uchun
   patch mavjudligini tekshir (§7 dagi jadval — aynan shu holat).
3. **Major ko'tarish sababsiz QILINMAYDI** — u ADR va migratsiya rejasini
   talab qiladi.
4. **Vaqtinchalik istisno** faqat quyidagilar bilan:
   - aniq paket + advisory ID;
   - nega hozir tuzatib bo'lmaydi;
   - qoldiq risk bahosi;
   - **muddat (expiry) sanasi**;
   - shu hujjatga yozuv.
   Mexanizm: npm uchun — hech qanday blanket allowlist YO'Q; pip uchun —
   `pip-audit --ignore-vuln <ID>` (aniq ID).
5. **Manba papkasini blanket allowlist qilish TAQIQLANADI.**
6. **Skanerni o'chirish/bypass qilish TAQIQLANADI** — testlar `|| true`,
   `continue-on-error` va `if:` ni bloklaydi.

**Bugungi kunda ochiq istisno YO'Q.**

---

## 7. Topilgan zaifliklar

### npm (prod bog'liqliklari) — `npm audit --omit=dev`

**Jami: 19 (10 moderate, 9 high, 0 critical).**

| Paket | Jiddiylik | O'rnatilgan | Kerakli minimal | To'g'ridan-to'g'rimi |
|---|---|---|---|---|
| `next` | high | 15.5.19 | **15.5.21** | ha (`apps/web`) |
| `sharp` | high | 0.34.5 | **0.35.0** | yo'q (next) |
| `postcss` | high | 8.4.31 (next ichida) | **8.5.23** | yo'q (next) |
| `picomatch` | high | 4.0.1 | **4.0.4** | yo'q |
| `nanoid` | high | 3.3.15 | **3.3.17** | yo'q |
| `multer` | high | 2.0.2 | **2.2.0** | yo'q (nest platform-express) |
| `lodash` | high | 4.17.21 | **4.17.24** | yo'q (nest swagger/config) |
| `js-yaml` | high | 4.1.0 | **4.3.1** | yo'q (nest swagger) |
| `@nestjs/platform-express` | high | 10.4.22 | — (tranzitiv orqali hal bo'ladi) | ha (`apps/api`) |
| `qs`, `uuid`, `body-parser`, `express`, `file-type`, `@nestjs/*` | moderate | — | — | gate'dan past |

**Muhim tahlil:** `npm audit` ularning HAMMASI uchun **major** ko'tarishni
taklif qiladi (`@nestjs/platform-express@11`, `@nestjs/swagger@11`,
`next@16`), chunki fix yo'lini **ota-paket diapazoni** bo'yicha hisoblaydi.
Aslida har bir zaif paketning O'ZI uchun **patch/minor** tuzatma mavjud
(yuqoridagi jadval, registry'dan tekshirilgan). Ya'ni **Nest yoki Next
major ko'tarish SHART EMAS**.

`@nestjs/platform-express` ning high darajasi butunlay TRANZITIV
(`multer` + `express`/`body-parser` orqali) — multer tuzatilsa u ham
yopiladi.

### Python engine — `pip-audit`

| Paket | ID | O'rnatilgan | Tuzatilgan |
|---|---|---|---|
| `cryptography` | PYSEC-2026-3552 | 49.0.0 | **50.0.0** |

Tranzitiv: `google-genai → google-auth → cryptography`, va
`requirements.txt` da **pin qilinmagan** edi — ya'ni qaysi versiya
o'rnatilishi resolver kayfiyatiga bog'liq edi.

---

## 8. Tuzatilgan zaifliklar

### ✅ Python — TUZATILDI va JONLI TASDIQLANDI

`requirements.txt` ga xavfsizlik **poli** qo'shildi:

```
cryptography>=50.0.0
```

`>=` (qat'iy pin emas) — google-auth kelajakda yangiroq versiyani talab
qilsa to'smaydi, lekin zaif versiyaga tushib qolishni imkonsiz qiladi.

**Tasdiq (lokal, haqiqiy):**
```
pip-audit  ->  oldin: 1 zaiflik (cryptography 49.0.0)
               keyin: "No known vulnerabilities found", exit 0
ruff check .   ->  All checks passed!
pytest -q      ->  14 passed
```

### ⛔ npm — BLOKLANGAN (muhit cheklovi)

Tuzatish **aniqlangan va tayyor**, lekin bu muhitda **qo'llab bo'lmadi**.

**Sabab:** bu sandbox'da `npm install` **amalda ishlamaydi** — u har doim
"up to date" deb qaytadi, lockfile yozmaydi va daraxtni qayta hal
qilmaydi. Buni izolyatsiyada tasdiqladim: `/tmp` da yangi bo'sh loyiha
yaratib `npm install` qilinganda ham `package-lock.json` **umuman
yaratilmadi**. (`npm view` — registry o'qishi — ishlaydi; `pip install`
ham ishlaydi. Faqat npm o'rnatish yo'li ishlamaydi.)

Natijada `overrides` bloki `package-lock.json` ga hech qanday ta'sir
qilmadi (`lock.packages[""].overrides === null`, versiyalar o'zgarmadi).

**Nega baribir commit qilinmadi:** `package.json` da `overrides` bo'lib,
lockfile'da bo'lmasa, **`npm ci` sinxronlik xatosi bilan yiqiladi** —
ya'ni CI'ning BARCHA ishlari (nafaqat audit) buzilardi. Yarim qo'llangan
tuzatishni commit qilishdan ko'ra, uni hujjatlashtirish xavfsizroq.
Shu sababli `package.json`, `package-lock.json` va `apps/web/package.json`
**HEAD holatiga qaytarildi** (ishchi daraxt toza).

**TAYYOR RETSEPT** (ishlaydigan npm bo'lgan muhitda bitta marta):

```jsonc
// package.json (ildiz) — `engines` dan keyin
"overrides": {
  "js-yaml":   "^4.3.1",
  "lodash":    "^4.18.1",
  "multer":    "^2.2.0",
  "picomatch": "^4.0.5",
  "postcss":   "^8.5.26",
  "sharp":     "^0.35.3"
}
```
```jsonc
// apps/web/package.json
"next": "^15.5.23"     // ilgari ^15.1.6
```
```bash
npm install          # lockfile'ni qayta hal qiladi
npm audit --omit=dev --audit-level=high   # 0 high kutiladi
npm run build && npm test                  # regressiya tekshiruvi
```

Barcha maqsad versiyalar registry'da MAVJUDLIGI tasdiqlangan va
hammasi **bir xil major** ichida (`sharp` 0.34→0.35 — pre-1.0 minor).
Major ko'tarish (Nest 11 / Next 16) **kerak emas**.

**Muqobil yo'l:** hech narsa qilmasdan kutish ham mumkin — Dependabot
dushanba kuni aynan shu xavfsizlik yangilanishlarini PR sifatida ochadi
(`security-updates` guruhi major-ignore'dan mustasno) va PR o'z-o'zidan
CI'dan o'tadi.

---

## 9. Test natijalari

| Tekshiruv | Natija |
|---|---|
| `prisma validate` | ✅ |
| `tsc --noEmit` (api / web) | ✅ / ✅ |
| `eslint` (api / web) | ✅ 0 xato / ✅ 0 xato |
| `jest` | ✅ **60 to'plam / 746 test** (bazaviy: 59 / 727) |
| `nest build` | ✅ |
| `next build` | ✅ |
| `prisma migrate status` | ✅ toza (33 migratsiya) |
| `ruff check` (engine) | ✅ |
| `pytest` (engine) | ✅ 14 passed |
| `pip-audit` (engine) | ✅ **0 zaiflik** |
| `npm audit --omit=dev --audit-level=high` | ⛔ **exit 1 — 9 high** (§8) |

**Yangi testlar (19):** `dependency-security.spec.ts` — npm audit
bayroqlari (`--omit=dev`, `--audit-level=high`), bloklovchi qadamda
`|| true`/`continue-on-error`/`if:` yo'qligi, pip-audit haqiqiy
`requirements.txt` ni tekshirishi va versiyasi qotirilganligi, Dependabot
haftalik jadvali va uchala ekotizimi, Snyk takrorlanmagani, `cryptography`
polining mavjudligi va `>=` ekanligi.

## 10. CI xavfsizlik natijasi

| Ish | Bloklovchimi | Kutilgan holat |
|---|---|---|
| `npm-audit` | HA | ⛔ **QIZIL** — §8 dagi retsept qo'llanmaguncha |
| `pip-audit` | HA | ✅ yashil (lokal tasdiqlangan) |
| `secrets` (gitleaks) | HA | SEC-14 dan meros |

> **OGOHLANTIRISH:** `npm-audit` ishi keyingi push'da **CI'ni qizartiradi**.
> Bu — kutilgan va TO'G'RI xulq: 9 ta high zaiflik haqiqatan mavjud.
> Gate ataylab yumshatilmadi (Contract: "security scan'ni yashirma yoki
> bypass qilma"). Tuzatish — §8 dagi bitta `npm install`.

## 11. Qolgan risklar

1. **9 ta high npm zaifligi OCHIQ** — tuzatish tayyor, qo'llash bu
   muhitda imkonsiz (§8). Eng jiddiylari: `next` (SSRF, cache confusion,
   DoS — 8 ta advisory), `sharp`/libvips (CVE-2026-33327 va boshqalar),
   `postcss` (path traversal, arbitrary file read).
2. **10 ta moderate gate'dan past** (`qs`, `uuid`, `body-parser`,
   `express`, `file-type`, `@nestjs/*`) — ular `--audit-level=high`
   bo'yicha bloklamaydi, lekin hisobot qadamida ko'rinadi. Ularning
   ko'pi Nest 10 ekotizimiga bog'langan; Nest 11 ga o'tish alohida ADR.
3. **`pip-audit` jiddiylik bo'yicha filtrlay olmaydi** — har qanday
   topilma bloklaydi (§4). Kelajakda shovqin bo'lsa, `--ignore-vuln`
   (aniq ID + muddat) yagona ruxsat etilgan yo'l.
4. **CI'da haqiqiy ishga tushirilmagan** — `npm-audit` va `pip-audit`
   ishlari lokal ekvivalent buyruqlar bilan tekshirildi va konfiguratsiya
   testlar bilan qulflandi, LEKIN GitHub Actions'da hali ishlamadi.
   Birinchi push'da tasdiqlanadi.
5. **`requirements-camera.txt` auditdan tashqarida** (§4) — u prod'da
   o'rnatilmaydi; kamera real ishlatila boshlansa auditga qo'shilishi kerak.
6. **Dependabot faqat konfiguratsiya** — u repo GitHub'ga push
   qilinganidan keyin ishlay boshlaydi; bu yerda tekshirib bo'lmaydi.

## 12. Istisnolar va muddatlar

**Ochiq istisno YO'Q.** Hech qanday advisory `--ignore-vuln` bilan
o'chirilmagan, hech qanday paket allowlist qilinmagan, hech bir skaner
yumshatilmagan.

§8 dagi npm holati — istisno EMAS, **bajarilmagan ish** (CI uni qizil
holda ko'rsatib turadi).

## 13. Keyingi vazifa

Contract §7 xavfsizlik bloki (SEC-01…SEC-15) **tugadi**.
Keyingi faza — **Phase 5: Observability & Operations** (Contract §3):
Sentry ×3 servis, `pino` JSON loglar, request-id propagatsiyasi, 4 biznes
alert, `/api/health` chuqurlashtirish (DB+engine+redis), backup/restore
mashqi, incident runbook.

**Undan OLDIN tavsiya etiladi:** §8 dagi npm retseptini qo'llash — u bitta
buyruq va CI'ni yashil holatga qaytaradi.
