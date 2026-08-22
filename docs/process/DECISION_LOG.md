---
doc: DECISION_LOG
version: 1.0
status: ACTIVE
created: 2026-08-14
last_verified: 2026-08-14
supersedes: —
superseded_by: —
---

# DECISION LOG — append-only

**Qoida:** [`SPEC_SYSTEM.md`](SPEC_SYSTEM.md) §5.4.

> **Bu fayl APPEND-ONLY.** Qator **hech qachon o'chirilmaydi va
> tahrirlanmaydi** — faqat pastga qo'shiladi. Qaror bekor qilinsa, uni
> o'chirish emas, **yangi qator** bilan bekor qilish yoziladi
> ("X qarori bekor qilindi, sabab: …").

**Har qator qachon yoziladi:**

- Hujjat haqiqatga zid chiqdi va tuzatildi (§5.3 oltin qoida)
- `[CALIBRATE]` raqam `[MEASURED]` ga aylandi
- Blueprint yoki task spec o'zgardi
- Verification `FAIL` bo'ldi, lekin qarz **ochiq sabab bilan qabul
  qilindi** (§6.4 istisnosi)
- Roadmap ustuvorligi o'zgardi

---

| Sana | Nima o'zgardi | Nega | Ta'sirlangan hujjatlar |
|---|---|---|---|
| 2026-08-14 | V3 strategiya to'plami yaratildi (roadmap, build-vs-buy, pricing, metrics, business, safety, kill-criteria + ADR-023…032) | Contract §3 tartibi metering'ni Phase 7 ga qo'ygan edi; zarar hajmi o'lchanmagani aniqlandi (`Message.tokensIn` kodda 0 marta yoziladi) | `strategy/*`, `adr/ADR-023…032`, `ENGINEERING_CONTRACT_ADDENDUM_V3.md` |
| 2026-08-14 | ADR-001…020 Contract §5 dan alohida fayllarga ko'chirildi | Contract §5 buni talab qilgan, lekin bajarilmagan edi | `adr/ADR-001…020` |
| 2026-08-14 | Spec System qabul qilindi (to'rt qavat, JIT blueprint, uch tier task spec, mashinada tekshiriladigan DoD, yangi-sessiya verification) | Qaror egaligini ajratish: Claude Code arxitektor emas, ijrochi bo'lishi kerak | `process/SPEC_SYSTEM.md`, `process/DECISION_LOG.md` |
| 2026-08-16 | Free tier balans-yechishdan **kunlik hisoblagichga** o'tdi (10/kun, `chargeForMessage` free'da no-op) + LLM zanjiri **OpenRouter ko'p-model rotatsiyasiga** (5 ta `:free`, tool-calling'li) + hisob darajasidagi buferli budjet (45/kun, Redis) | Nol byudjet: har bepul obunachiga pullik chaqiruvni moliyalashtirib bo'lmaydi. Bundan tashqari diagnostika ko'rsatdiki, yangi foydalanuvchi balansi 0 bo'lgani uchun BIRINCHI xabarda 402 olardi — ya'ni free tier amalda mavjud emas edi | `strategy/PRICING_ARCHITECTURE.md` §3.0/§3.1, `strategy/BUILD_VS_BUY.md` (model routing qatori), `strategy/SAFETY_POLICY_LAYER.md` §8bis |
| 2026-08-17 | **Cron soni tuzatildi: 8 → 7.** Oldingi auditlar `grep "@Cron"` ning 8 moslik bergani asosida "8 ta cron" deb yozgan; sakkizinchi moslik — `apps/api/src/redis/cron-leader.service.ts:8` dagi **hujjat izohi**, dekorator emas. Qat'iy o'lchov `grep -rn '^\s*@Cron(' apps/api/src --include=*.ts \| grep -v spec` → **7**. Yon topilma: `runExclusive` 7 faylda uchraydi, lekin haqiqiy qamrov — **2/7 cron** (3 spec + qulf servisining o'zi + `marketplace.service.spec.ts` uni faqat mock qiladi, `marketplace.service.ts` chaqirmaydi) | SPEC_SYSTEM §5.3 (oltin qoida): hujjatdagi raqam haqiqatga zid chiqdi. Amaliy ta'siri — P0-4 (cron taqsimlangan qulf) qamrovi 6 emas, **5 cron**: `impersonation-admin:225`, `briefing:91`, `goals:150`, `alert-evaluator:63`, `competitor-price:131`. **Bajarilishi kerak:** `strategy/METRICS.md` §1 qatori tuzatiladi yoki `STALE` deb belgilanadi. `status/current-state-2026-08-13.md` §1 esa ATAYLAB tuzatilmaydi — u o'z header'ida muzlatilgan snapshot deb e'lon qilingan ("YANGILANMAYDI", §5.2 `ARCHIVED`); tuzatish shu jurnal va blueprint'da yashaydi | `strategy/METRICS.md` §1 (tuzatilishi kerak), `status/current-state-2026-08-13.md` §1 (muzlatilgan — tegilmaydi), `blueprints/P0_BLUEPRINT.md` §1.1/§1.2 |
| 2026-08-17 | **P0-3 (SEC-07 domain allowlist) implement qilindi — env darajasida.** Yangi: `automation/domain-allowlist.ts` (+ 2 spec), `BrowserBridge` ga allowlist opsiyalari, `AutomationService` da `DeviceActionLog` blok yozuvi, `.env.example` da `AGENT_DOMAIN_ALLOWLIST`/`_ENFORCE`. 80 test, 0 regressiya (151 test qo'shni suite'larda), migratsiyasiz | Contract SEC-07 — yagona yopilmagan Critical; blueprint §2.8 D2 (safe demo path) unga bog'langan. Env yo'li tanlandi, chunki u migratsiya talab qilmaydi va AC ni to'liq qoplaydi | `blueprints/P0_BLUEPRINT.md` P0-3 §16 (DoD holati belgilandi), `.env.example` |
| 2026-08-17 | **P0_BLUEPRINT P0-3 §6 dagi ma'lumot modeli NOTO'G'RI edi, tuzatildi.** Blueprint `Agent.toolsConfig` ni `{ browser: { allowedDomains } }` obyekt deb yozgan; haqiqatda u **massiv** (`schema.prisma:490`: "JSON array of ToolSpec", `CreateAgentDto.toolsConfig?: ToolSpecDto[]`). Bundan tashqari `AutomationService.run()` da `agentId` **umuman yo'q** — brauzer oqimi agentga bog'lanmagan | SPEC_SYSTEM §5.3: hujjat haqiqatga zid chiqdi, o'sha sessiyada tuzatildi. Oqibati: agent-darajasidagi allowlist va "6 domen → 400" DoD bandi **bajarilmadi** va ochiq qarz sifatida yozildi; `resolveAllowlist({env, agent})` interfeysi tayyor turibdi | `blueprints/P0_BLUEPRINT.md` P0-3 §6 (tuzatish bloki), §7, §16 |
| 2026-08-17 | **P0-3 rollback semantikasi aniqlashtirildi:** `AGENT_DOMAIN_ALLOWLIST_ENFORCE=false` "shadow rejim" (log yozib, bloklamaslik) EMAS — u tekshiruvni **umuman bajarmaydi** | Bo'sh allowlist (`domains: []` = "hech narsaga ruxsat yo'q", fail-closed) va majburlashning o'chirilishi ("tekshirma") — ikki xil holat. Bitta bayroqqa siqilsa, fail-closed jimgina fail-open'ga aylanardi. Kodda alohida `enforceDomainAllowlist` bayrog'i bilan ajratildi | `blueprints/P0_BLUEPRINT.md` P0-3 §15, `automation/browser-bridge.ts` |
| 2026-08-17 | **UI verifikatsiyasida SKRINSHOT MAJBURIYATI BEKOR QILINDI.** `P0_BLUEPRINT` §6.2 dagi "DEMO MODE / ENGINEERING MODE" ikki rejimi va har holat uchun skrinshot talabi olib tashlandi; o'rniga **dasturiy tekshiruv V1–V4** (statik → sahifa ko'tarilishi → konsol tozaligi → DOM va `getComputedStyle` assertlari: holatlar, token qiymatlari, kontrast ≥4.5:1, overflow, truncate, klaviatura, reduced-motion). "Founder tasdiqlaguncha keyingi task boshlanmaydi" qoidasi ham bekor — tasdiq endi bloklovchi emas | Founder qarori (2026-08-17). Texnik jihatdan bu **kuchliroq** dalil: skrinshot "shunday ko'rinadi" deydi, DOM+uslub asserti "aynan shu token, aynan shu qiymat" deydi va takrorlanadi. Bloklovchi tasdiq esa solo founder uchun ijro to'sig'iga aylanardi (SPEC_SYSTEM §10) | `blueprints/P0_BLUEPRINT.md` §6.2, §9 (9-savol), UI-1…UI-11 DoD bandlari |
| 2026-08-17 | **P0 blueprint TIER A uchun 20 emas, 16 bo'lim ishlatdi.** Tushirilganlar: `User problem`, `Business value`, `UX/UI talablari`, `Cost ta'siri` | Birinchi uchtasi V3 strategiya hujjatlarida (roadmap, pricing, metrics) allaqachon yozilgan — 15 taskda takrorlash SPEC_SYSTEM §10 ogohlantirgan "hujjat fabrikasi"ning aynan o'zi. UX talablari Qism B (TIER B, 11 UI task) ga ko'chdi. `Cost ta'siri` **yo'qolmadi** — u `[BUDGET-BLOCKED]` belgisi va §8 yakuniy jadval ustuni sifatida saqlandi, chunki nol byudjet sharoitida xarajat alohida bo'lim emas, *scope* qarori. Farq §0.2 da ochiq asoslangan edi, lekin jurnalga yozilmagan — endi yozildi | `process/SPEC_SYSTEM.md` §3 (TIER A ta'rifi — o'zgarmaydi), `blueprints/P0_BLUEPRINT.md` §0.2 |
