# Shriftlar — o'z-o'zidan hosting (CDN YO'Q)

| Fayl | Oila | Litsenziya | Manba |
|---|---|---|---|
| `CabinetGrotesk-Variable.woff2` | Cabinet Grotesk (100–900) | ITF Free Font License — tijorat uchun ruxsat, self-hosting ruxsat | fontshare.com/fonts/cabinet-grotesk |
| `Switzer-Variable.woff2` | Switzer (100–900) | ITF Free Font License | fontshare.com/fonts/switzer |

Uchinchi oila — **IBM Plex Mono** (OFL) — `next/font/google` orqali keladi
(u ham build vaqtida yuklab olinib, o'zimizning domendan beriladi; runtime'da
Google'ga so'rov ketmaydi).

## Nega variable (o'zgaruvchan) versiya

Ikkalasi ham bitta faylda 100–900 oralig'ini beradi: 41 KB + 43 KB.
Statik og'irliklar bilan (500/700/800 + 400/500) bu 5 ta fayl va ~2× hajm
bo'lardi.

## Nega CDN emas

Loyiha qoidasi: tashqi CDN'dan shrift YUKLANMAYDI (`layout.tsx` izohi).
Sabab — uchinchi tomon uzilishi sahifani matnsiz qoldiradi va CSP yuzasini
kengaytiradi. `next/font/local` fayllarni build'ga qo'shadi, hash qiladi va
`font-display: swap` bilan beradi.

## Yangilash

Fontshare CSS endpointidan `@variable` woff2 havolasini olib, shu yerdagi
faylni almashtiring:

```bash
curl -s "https://api.fontshare.com/v2/css?f%5B%5D=cabinet-grotesk@variable&display=swap"
```
