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
