# ADR-001 — Authentication

**Source:** `ENGINEERING_CONTRACT.md` §5 (ADR-001) · **Sana:** 2026-08-02 · **Holat:** ACCEPTED
**Eslatma:** mazmun Contract'dan **o'zgartirilmasdan** ko'chirildi (Contract §5:
*"Bular `docs/adr/` ga alohida fayllar sifatida ko'chiriladi"*). Ziddiyat bo'lsa — Contract ustun.

**Problem:** 30 kunlik imzolangan JWT, bekor qilish mexanizmi yo'q; Clerk qoldiqlari o'lik kod sifatida turibdi.

**Decision:** O'z OTP + TOTP + HS256 JWT saqlanadi; `User.tokenVersion` qo'shiladi, TTL 7 kunga tushiriladi, jimgina yangilash `/api/session/refresh` orqali; Clerk butunlay olib tashlanadi.

**Alternatives:** (a) Clerk/Auth0'ga to'liq o'tish, (b) refresh-token jadvali, (c) hozirgicha qoldirish.

**Why rejected:** (a) O'zbek raqami + Eskiz SMS + halal brendi bilan tashqi provayder oqimi mos emas; foydalanuvchi boshiga narx marja bilan mos kelmaydi. (b) alohida jadval + rotatsiya mantiqi `tokenVersion`dan 5× murakkab, foydasi marginal. (c) qurilma-boshqaruv huquqlari bilan bekor qilinmaydigan token — qabul qilib bo'lmas.

**Long-term impact:** har foydalanuvchida bir marta chiqib-kirish; keyin xavfsizlik hodisasida bitta SQL bilan butun parkni bekor qilish imkoni.
