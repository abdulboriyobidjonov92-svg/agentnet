# SEC-13 — CSP va qolgan xavfsizlik sarlavhalari: audit va holat

**Sana:** 2026-08-10 · **Contract:** §7 SEC-13, A4/Konstitutsiya #2 (BFF), ADR-015
**Oldingi bosqich:** [`sec12-audit.md`](sec12-audit.md) (impersonation)

---

## 1. Boshlang'ich audit

Kod-baza tekshirildi (taxmin qilinmadi — har bir topilma `grep`/build natijasi):

| Savol | Topilgan holat |
|---|---|
| Next.js | 15.1.6, App Router, React 19 |
| NestJS | mavjud, `main.ts` da qo'lda sarlavhalar (helmet YO'Q) |
| Web'da CSP | **YO'Q** — `next.config.ts` da `headers()` umuman yo'q edi |
| Inline `<script>` | **BITTA** (`layout.tsx`, dark-mode klassi) |
| `<iframe>` / `<object>` | **0** |
| Worker / `EventSource` / WebSocket | **0** (oqim `fetch`+SSE bilan o'qiladi) |
| `eval` / `new Function` | **0** (ilova kodida) |
| Tashqi skript / CDN / analitika | **0** |
| Tashqi shrift | **0** — Geist `next/font` bilan o'z-o'zidan hosting |
| Tashqi rasm | **0**; `<img>` faqat `data:image/jpeg` skrinshot uchun |
| `style={{...}}` | **56 ta** (SSR'da `style="..."` atributiga aylanadi) |
| Brauzer API'lari | `navigator.clipboard.writeText`, `navigator.share` |
| Kamera | **server tomonda** RTSP (`/retail/camera/connect`), `getUserMedia` YO'Q |
| Statik sahifalar | **0** — build jadvalida barcha 36 marshrut `ƒ` (dynamic) |

### Statik sahifalar masalasi (nonce qarori uchun hal qiluvchi)

Nonce middleware'da yaratilgani uchun Next sahifalarni dinamik render'ga
o'tkazadi. **Bu yerda yo'qotiladigan narsa YO'Q:** SEC-13 dan OLDINGI build
jadvalida ham 36/36 marshrut `ƒ` edi. Build jadvali keyin ham AYNAN o'sha —
ya'ni nonce'ning render strategiyasiga narxi **nol**.

---

## 2. Mavjud xavfsizlik sarlavhalari (SEC-13 dan oldin)

| Sarlavha | Holat | Qayerda | Qaror |
|---|---|---|---|
| `X-Content-Type-Options` | bor (API) | `apps/api/src/main.ts` | SAQLANDI + web'ga qo'shildi |
| `X-Frame-Options: DENY` | bor (API) | `main.ts` | SAQLANDI + web'ga qo'shildi |
| `Referrer-Policy: no-referrer` | bor (API) | `main.ts` | API'da SAQLANDI; web'da `strict-origin-when-cross-origin` |
| `X-DNS-Prefetch-Control` | bor (API) | `main.ts` | SAQLANDI + web'ga qo'shildi |
| `Strict-Transport-Security` | bor (API, prod) | `main.ts` | SAQLANDI + web'ga AYNAN bir xil qiymat |
| `X-Powered-By` | o'chirilgan (API) | `main.ts` | web'da ham (`poweredByHeader: false`) |
| **CSP** | **YO'Q** | — | **QO'SHILDI** (web: nonce, API: `default-src 'none'`) |
| `Permissions-Policy` | YO'Q | — | QO'SHILDI (web) |
| COOP / COEP / CORP | YO'Q | — | COOP qo'shildi; COEP/CORP — §7 |

Helmet **kiritilmadi**: mavjud to'plam yetarli, u yangi bog'liqlik va
ikkinchi (ziddiyatli) siyosat manbaini keltirardi.

---

## 3. CSP bog'liqliklari (haqiqiy, repodan topilgan)

| Resurs | Manba | Nega kerak | Direktiva |
|---|---|---|---|
| Next runtime/hydration skriptlari | ichki (`_next/static`) | ilova umuman ishlashi uchun | `script-src 'self' 'nonce-…' 'strict-dynamic'` |
| Next RSC inline oqimi | ichki (inline) | App Router SSR payload'i | `'nonce-…'` (Next o'zi qo'yadi) |
| Tailwind/global CSS | ichki (`_next/static/css`) | UI | `style-src 'self'` |
| React inline `style` atributlari (56) | ichki | progress bar, tema o'zgaruvchilari | `style-src 'unsafe-inline'` (§5) |
| `next/font` (Geist) | ichki, o'z-hosting | tipografiya | `font-src 'self'` |
| BFF proxy `/api/backend/*` | ichki (same-origin) | barcha API chaqiruvlari | `connect-src 'self'` |
| AI oqimi `/api/chat/stream` | ichki (same-origin SSE) | chat javoblari | `connect-src 'self'` |
| Qurilma oqimi `/api/device/browser/stream` | ichki (same-origin SSE) | brauzer-agent qadamlari | `connect-src 'self'` |
| Brauzer-agent skrinshotlari | `data:image/jpeg;base64` | oqimdagi vizual tasdiq | `img-src data:` |
| Frame'lar | **yo'q** | — | `frame-src 'none'` |
| Worker'lar | **yo'q** | — | (alohida direktiva qo'shilmadi) |
| Formalar | ichki | login/sozlamalar | `form-action 'self'` |

**Tashqi origin YO'Q.** To'lov (Payme/Click) va Telegram ulashish
`window.open` bilan YANGI VARAQDA ochiladi — bu navigatsiya, subresurs
emas, ya'ni CSP direktivasi talab qilmaydi. Backend integratsiyalari
(Anthropic, Eskiz SMS, Telegram bot, Payme/Click API) FAQAT server
tomonda chaqiriladi va brauzer `connect-src`iga **ataylab kiritilmadi**.

---

## 4. Yakuniy CSP

### Web (brauzerga beriladigan HTML) — `middleware.ts`

```
default-src 'self';
script-src 'self' 'nonce-<har javobda yangi>' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
frame-src 'none';
frame-ancestors 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests            ← faqat prod
```

Dev'da qo'shimcha: `script-src ... 'unsafe-eval'` (faqat dev, §6).

Nonce: `crypto.getRandomValues(16 bayt)` → base64, **har javob uchun
yangi**, hech qayerda saqlanmaydi/qattiq yozilmaydi. Next uni SO'ROV
sarlavhasidan o'qib o'z `<script>` teglariga qo'yadi (brauzerda
tasdiqlandi: 61/62 skript nonce oldi; nonce'siz bittasi — **bo'sh**
inline skript, uzunligi 0).

### API (JSON) — `apps/api/src/common/security-headers.ts`

```
default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'
```

API HTML bermaydi va hech qanday resurs yuklamaydi — eng qattiq siyosat
mumkin. Yagona istisno: `/api/docs` (Swagger, **faqat dev'da mavjud**) —
u o'z skript/stilini yuklaydi, shuning uchun o'sha yo'lda CSP qo'yilmaydi;
qolgan sarlavhalar o'z joyida qoladi.

---

## 5. CSP istisnolari

| Istisno | Nega kerak | Vaqtinchalimi | Tozalash yo'li |
|---|---|---|---|
| `style-src 'unsafe-inline'` | 56 ta `style={{...}}` SSR'da `style="..."` atributiga aylanadi (nonce atributga qo'llanmaydi) + `next/font` head'ga inline `<style>` qo'yadi | uzoq muddatli | `style-src-attr`ga bo'lish — **hozir QILINMADI**, chunki Firefox `style-src-attr`ni tanimaydi va `style-src`ga qaytadi, ya'ni Firefox'da butun UI buzilardi. Haqiqiy yo'l: inline `style`larni CSS o'zgaruvchilari/klasslarga ko'chirish |
| `script-src 'unsafe-eval'` **faqat dev** | Next dev serveri HMR uchun `eval`-asosli source-map ishlatadi | dev'ga bog'langan | tozalash shart emas — prod policy'da yo'q va test bilan qulflangan |
| `img-src data:` | brauzer-agent skrinshotlari SSE orqali base64 keladi | uzoq muddatli | skrinshotlarni obyekt-saqlagichga (R2, ADR-007) ko'chirilganda `data:` olib tashlanadi |

**Yo'q narsalar:** `script-src *`, `connect-src *`, `object-src *`,
`frame-ancestors *`, `https:`/`http:` ochiq sxemalari, prod'da
`unsafe-eval`, `script-src 'unsafe-inline'`, hech qanday tashqi domen.

### Markdown ichidagi tashqi rasmlar — ataylab bloklanadi

AI javoblari `react-markdown` bilan render qilinadi. Javobda
`![](https://tashqi/rasm.png)` bo'lsa, `img-src 'self' data:` uni
**bloklaydi**. Bu — xato emas, **maqsad**: aks holda model chiqarayotgan
(prompt-injection bilan boshqarilishi mumkin bo'lgan) URL brauzerni
ixtiyoriy hostga so'rov yuborishga majburlardi (piksel-kuzatuv /
ma'lumot eksfiltratsiyasi). Matn normal render bo'ladi.

---

## 6. Muhit xulqi

| | Development | Test (jest) | Production |
|---|---|---|---|
| CSP | bor, `'unsafe-eval'` bilan | sarlavhalar sof funksiyalar sifatida tekshiriladi | bor, `'unsafe-eval'`SIZ |
| `upgrade-insecure-requests` | **yo'q** (lokal HTTP ishlashi uchun) | — | **bor** |
| HSTS | **yo'q** (lokal HTTP) | `undefined` deb qulflangan | `max-age=15552000; includeSubDomains` |
| Swagger CSP istisnosi | qo'llanadi (`/api/docs` faqat dev'da) | qulflangan | Swagger prod'da umuman yoqilmaydi |
| CSP rejimi | enforce | — | enforce (`CSP_REPORT_ONLY=1` bilan report-only) |

**"Dev'da hamma narsani o'chirish" YO'Q** — farq aynan uchta aniq
nuqtada: `unsafe-eval`, `upgrade-insecure-requests`, HSTS.

### Report-only va hisobot endpointi

Contract DoD "report-only'dan boshlanadi, 2 hafta kuzatiladi" deydi.
Kod **enforce** holatida yetkaziladi (lokal brauzer tekshiruvida 0
buzilish — §9), lekin operator bosqichma-bosqich chiqarishni xohlasa
`CSP_REPORT_ONLY=1` env bitta qadamda kuzatuv oynasini beradi.

`report-uri`/`report-to` **ataylab qo'shilmadi**: hisobot endpointi —
cheklanmagan, hujumchi boshqaradigan payload oqimi. Contract uni
Sentry'ga ulashni talab qiladi; Sentry — Phase 5 ishi va repoda hali
yo'q. Ikkinchi observability tizimi yaratilmadi (SEC-13 doirasidan
tashqari).

---

## 7. COOP / COEP / CORP

| Siyosat | Qaror | Sabab |
|---|---|---|
| **COOP** `same-origin` | **YOQILDI** (web) | Kod-bazada `window.opener` **umuman yo'q** — to'lov/ulashish popup'lari opener aloqasiga tayanmaydi. Tabnabbing yopiladi, hech narsa buzilmaydi |
| **COEP** | **YOQILMADI** | `require-corp` har bir cross-origin subresursdan CORP talab qiladi. Foyda — cross-origin izolyatsiya (SharedArrayBuffer), ilovada u ishlatilmaydi. Nol foyda, real sinish riski |
| **CORP** (web) | **YOQILMADI** | `/s/<token>` ulashish sahifasi ijtimoiy platformalar uchun OG-preview beradi; `same-origin` CORP bu yuzani keraksiz cheklardi. CSP `frame-ancestors` allaqachon asosiy tahdidni yopgan |
| **CORP** (API) | **YOQILMADI** | API brauzerdan cross-origin chaqirilishi mumkin (CORS bilan boshqariladi). CORP qo'shish CORS bilan ziddiyat yaratardi |

---

## 8. Xavfsizlik sarlavhalari matritsasi

| Sarlavha | Dev | Test | Production | Manba | Holat |
|---|---|---|---|---|---|
| `Content-Security-Policy` (web) | ✅ +`unsafe-eval` | n/a | ✅ | `middleware.ts` | enforce |
| `Content-Security-Policy` (API) | ✅ | ✅ | ✅ | `api/common/security-headers.ts` | enforce |
| `Strict-Transport-Security` | ❌ | ✅ (yo'qligi) | ✅ | `next.config.ts` + `api/main.ts` | `preload`SIZ |
| `X-Content-Type-Options` | ✅ | ✅ | ✅ | `next.config.ts` + API | nosniff |
| `Referrer-Policy` | ✅ | ✅ | ✅ | web: `next.config.ts`, API: `main.ts` | web `strict-origin-when-cross-origin`, API `no-referrer` |
| `X-Frame-Options` | ✅ | ✅ | ✅ | `next.config.ts` + API | `DENY` (CSP bilan ziddiyatsiz) |
| `Permissions-Policy` | ✅ | n/a | ✅ | `next.config.ts` | 11 xususiyat yopiq |
| `Cross-Origin-Opener-Policy` | ✅ | n/a | ✅ | `next.config.ts` | `same-origin` |
| `X-DNS-Prefetch-Control` | ✅ | ✅ | ✅ | `next.config.ts` + API | `off` |
| `X-Powered-By` | o'chirilgan | n/a | o'chirilgan | `poweredByHeader:false` + API | — |
| COEP / CORP | — | — | — | — | baholandi, YOQILMADI (§7) |

**Har sarlavhaning YAGONA manbasi bor.** CSP — faqat middleware (nonce
har javobda kerak); qolganlari — faqat `next.config.ts` (u `_next/static`
chunk'lari va shriftlarni ham qamraydi, middleware matcher esa ularni
chiqarib tashlaydi). Takrorlanish/ziddiyat yo'q.

---

## 9. Brauzer tekshiruvi (haqiqiy, lokal Chromium)

**Dev (`localhost:3100`, API `localhost:3001` bilan birga):**

| Tekshiruv | Natija |
|---|---|
| 16 marshrut sarlavhasi | hammasi 200, CSP bor, har birida **noyob nonce** |
| Next skriptlariga nonce | 61/62 (qolgani — uzunligi 0 bo'lgan bo'sh inline skript) |
| CSP buzilishlari (`/`, `/dashboard`, `/agentos-demo` 3D) | **0** |
| Stillar | 3 stylesheet, 905 CSS qoida, fon `rgb(0,0,0)` |
| Shriftlar | 7 Geist yuzi ro'yxatdan o'tgan, yuklanadi |
| Dark mode | `darkApplied: true` (inline skriptsiz — SSR `className`) |
| Login (BFF orqali) | OTP so'rov 200, verify 200, sessiya 200 |
| httpOnly token | JS'da **ko'rinmaydi** (`agentnet_token` yo'q) |
| AI oqimi `/api/chat/stream` | 200 `text/event-stream`, SSE eventlari oqdi, **0 buzilish** |
| Qurilma oqimi | 200, `start` + `browser_ready` eventlari, **0 buzilish** |
| Impersonation banneri | render bo'ldi, qizil, taymer ishlaydi (14:39) |
| Impersonation cookie | imp token JS'da ko'rinmaydi, meta ko'rinadi |
| Admin redirect (impersonation paytida) | `/admin/users` → `/dashboard` |
| BFF proxy orqali API CSP | `default-src 'none'` to'g'ri o'tdi (ikki siyosat to'qnashmaydi) |

**Production build (`next start`, `localhost:3200`):**

| Tekshiruv | Natija |
|---|---|
| `script-src` | `'self' 'nonce-…' 'strict-dynamic'` — **`unsafe-eval` YO'Q** |
| `upgrade-insecure-requests` | bor |
| HSTS | `max-age=15552000; includeSubDomains` (preload yo'q) |
| Skriptlar | **11/11** nonce bilan, React hydrate bo'ldi |
| Stillar | 906 CSS qoida, dark mode ishlaydi |
| Konsol | **umuman bo'sh** (0 xabar, 0 buzilish) |
| Login prod CSP ostida | 200, **0 CSP buzilishi** |

**Bloklangan resurs yo'q. Kutilmagan tarmoq xatosi yo'q.**

Yo'l-yo'lakay tuzatilgan konsol shovqini: `Permissions-Policy` dan
`web-share` olib tashlandi — Chrome bu nomni tanimaydi va har sahifada
ogohlantirish berardi. Amaldagi siyosat **o'zgarmadi** (sanab o'tilmagan
xususiyat uchun default allowlist allaqachon `self`).

---

## 10. YO'L-YO'LAKAY TOPILGAN VA TUZATILGAN: API boot'da yiqilardi

Brauzer tekshiruvi majburiy bo'lgani uchun API ishga tushirildi va
**darhol yiqildi**:

```
Nest can't resolve dependencies of the AuthGuard (PrismaService, Reflector, ?).
Please make sure that the argument ImpersonationService at index [2]
is available in the ReferralModule context.
```

**Sabab (SEC-12 regressiyasi):** SEC-12 `AuthGuard`ga uchinchi
bog'liqlik qo'shdi. 20 ta modul esa `AuthGuard`ni O'Z `providers`
ro'yxatida saqlab kelayotgan edi — SEC-05 (Option B) dan qolgan **o'lik
meros**: `@UseGuards(AuthGuard)` chaqiruv-nuqtalari soni allaqachon
**nol** edi, guard `APP_GUARD` sifatida global.

**Nega hech bir tekshiruv ushlamadi:** birlik testlari guard'ni
`new AuthGuard(...)` bilan qo'lda yasaydi; `tsc` va `nest build` faqat
kompilyatsiya qiladi — DI grafigi ish vaqtida yig'iladi. Ya'ni SEC-12
"build passes" da'vosi to'g'ri edi, lekin **ilova ishga tushmasdi**.

**Tuzatish:** 20 modulning `providers`idan o'lik `AuthGuard` olib
tashlandi (Rule #38).

**Regressiya testi:** `src/app.module.spec.ts` — butun `AppModule`
Nest'ning `Test.createTestingModule` bilan HAQIQATAN yig'iladi
(`PrismaService` mock bilan, DB talab qilinmaydi). Test tishli ekani
tasdiqlandi: `AuthGuard` bitta modulga qaytarilganda u aynan yuqoridagi
xato bilan yiqiladi, olib tashlanganda o'tadi.

---

## 11. Ikkinchi xavfsizlik ko'rigi

| Qidirilgan | Natija |
|---|---|
| Wildcard CSP (`*`, `https:`, `http:`) | topilmadi (test bilan qulflangan) |
| `unsafe-eval` prod'da | yo'q (prod build sarlavhasidan tasdiqlandi) |
| `unsafe-inline` `script-src` da | yo'q |
| Takroriy/ziddiyatli sarlavha | yo'q — har sarlavha bitta manbadan (§8) |
| `X-Frame-Options` vs `frame-ancestors` | ikkalasi `DENY`/`'none'` — bir xil ma'no, test bilan qulflangan |
| Prod'da localhost origin | mumkin emas — `connect-src 'self'`, hech qanday env-dan origin olinmaydi |
| Meta-teg CSP | yo'q (faqat HTTP sarlavhasi) |
| Klientda token oshkorligi | yo'q — `agentnet_token`/`agentnet_imp` httpOnly, brauzerda tasdiqlandi |
| API'ni chetlab o'tish | aksincha — **kamaydi**: login ham endi BFF orqali |
| Dev istisnosining prod'ga sizishi | yo'q — `unsafe-eval` va Swagger istisnosi test bilan qulflangan |

---

## 12. Ataylab qilingan o'zgarish: login BFF orqali

`auth-form.tsx` brauzerdan NestJS'ga **to'g'ridan-to'g'ri** borardi
(`NEXT_PUBLIC_API_URL`) — butun ilovadagi yagona shunday joy.

Bu ikkita shartnomani buzardi: **Konstitutsiya #2 / A4** ("brauzer
NestJS'ga to'g'ridan-to'g'ri bormaydi") va **SEC-13 AC** ("connect-src
faqat o'z origin"). Uni CSP'ga kiritish arxitektura buzilishini
xavfsizlik siyosatiga **kodlab qo'yish** bo'lardi.

Shuning uchun uchta chaqiruv (`otp/request`, `otp/verify`,
`2fa/login-verify`) `/api/backend/*` proksisiga ko'chirildi.
**Endpointlar, DTO'lar, javob shakli va token oqimi AYNAN O'ZGARMADI** —
faqat transport yo'li. Yon foyda: login endi brauzer CORS'iga tayanmaydi.
Brauzerda to'liq tekshirildi (dev va prod build'da).

---

## 13. Bajarilgan buyruqlar

```bash
# API
cd apps/api && npx prisma validate      # valid
cd apps/api && npx tsc --noEmit         # 0 xato
cd apps/api && npx eslint src           # 0 xato (8 warning — meros)
cd apps/api && npx jest                 # 57 to'plam / 687 test
cd apps/api && npx nest build           # OK
cd apps/api && npx prisma migrate status # up to date (33 migratsiya)

# Web
cd apps/web && npx tsc --noEmit         # 0 xato
cd apps/web && npx eslint src next.config.ts  # 0 xato
cd apps/web && npx next build           # OK, 36/36 marshrut (jadval o'zgarmadi)
cd apps/web && npx next start -p 3200   # prod sarlavhalarini tekshirish uchun
```

**Migratsiya YO'Q** — SEC-13 sxemaga tegmaydi.

## 14. Testlar

| | SEC-12 (bazaviy) | SEC-13 |
|---|---|---|
| Test to'plamlari | 51 → 55 | **57** |
| Testlar | 560 → 671 | **687** |

Yangi: `src/common/security-headers.spec.ts` (15 test — CSP direktivalari
NOM bo'yicha parse qilinadi, satr taqqoslash emas; wildcard yo'qligi,
prod/dev HSTS farqi, Swagger istisnosi, `preload` yo'qligi) va
`src/app.module.spec.ts` (1 test — DI grafigi, §10).

**Web tomonda birlik testi qo'shilmadi** — `apps/web` da test
infratuzilmasi ATAYLAB yo'q (loyiha konvensiyasi). Web siyosati o'rniga
**jonli HTTP javoblari** bilan tekshirildi (§9), bu birlik testidan
kuchliroq dalil: haqiqiy sarlavha, haqiqiy nonce, haqiqiy brauzer.

---

## 15. Funksional regressiya qamrovi

| Oqim | Holat |
|---|---|
| Login (OTP so'rash/tasdiqlash) | ✅ dev va prod build'da tekshirildi |
| Logout | ✅ `/api/session` DELETE (cookie semantikasi o'zgarmadi) |
| Dashboard | ✅ |
| API so'rovlari / BFF | ✅ `billing/me`, `users/me`, `users/me/stats`, `agents` — 200 |
| AI chat + oqim | ✅ SSE oqdi (balans yo'qligi biznes javobi, transport ishlaydi) |
| Qurilma/brauzer oqimi | ✅ `start` + `browser_ready` eventlari |
| Autentifikatsiya cookie'lari | ✅ httpOnly saqlanadi |
| Impersonation (banner, cookie, stop, admin redirect) | ✅ |
| Marketplace / Templates / Connectors / Settings / Retail / Twin / Goals / Automation / Admin | ✅ 200 + CSP |
| Rasm yuklash | ✅ `data:` skrinshotlar |
| Dark mode | ✅ (endi inline skriptsiz) |
| i18n | ✅ `lang` atributi va lug'at ishlaydi |
| Mobil layout | ✅ SEC-12 da tekshirilgan, CSP layoutga ta'sir qilmaydi |
| Agent yaratish/ishga tushirish | ⚠️ **N/A** — balans talab qiladi, sinov hisobida balans yo'q. CSP nuqtai nazaridan `/api/backend/agents` va oqim yo'llari allaqachon tasdiqlangan |
| To'lov frontend oqimi | ⚠️ **N/A** — provayder kredensiallari yo'q (`Payme/Click sozlanmagan`). To'lov `window.open` bilan ochiladi, CSP direktivasi talab qilmaydi |

---

## 16. Qolgan risklar

1. **`style-src 'unsafe-inline'`** — hujjatlashtirilgan istisno (§5).
   Inline `style` atributlari orqali stil in'ektsiyasi nazariy jihatdan
   mumkin (skript emas). Tozalash yo'li §5 da.
2. **CSP hisobot oqimi yo'q** — buzilishlar faqat foydalanuvchi
   konsolida ko'rinadi. Contract buni Sentry'ga ulashni talab qiladi;
   Phase 5 ishi.
3. **Faqat Chromium'da tekshirildi** — bu muhitda boshqa brauzer yo'q.
   Firefox/Safari xulqi (ayniqsa `strict-dynamic` fallback'i) jonli
   tekshirilmagan. `'self'` zaxira sifatida qoldirilgani aynan shu
   sabab.
4. **HSTS `preload` yo'q** — ataylab (§4). Preload kerak bo'lsa, bu
   tashkilot qarori.
5. **Nonce dinamik render'ni majbur qiladi** — bu repoda narxi nol
   (§1), lekin kelajakda statik sahifa qo'shilsa, u avtomatik dinamik
   bo'ladi.
6. **SEC-12 dan meros:** impersonation yozish rejimi, `/admin/users/[id]`
   detal sahifasi, A15 tizim-aktori — SEC-13 ularga tegmadi.

---

## 17. O'zgargan fayllar

**Web:** `next.config.ts` · `src/lib/security-headers.ts` (yangi) ·
`src/middleware.ts` · `src/app/layout.tsx` · `src/components/auth/auth-form.tsx`

**API:** `src/common/security-headers.ts` (yangi) · `src/main.ts` ·
20 ta `*.module.ts` (o'lik `AuthGuard` provider'i olib tashlandi)

**Testlar:** `src/common/security-headers.spec.ts` (yangi) ·
`src/app.module.spec.ts` (yangi)

**Hujjat:** `docs/status/sec13-audit.md` (shu fayl)
