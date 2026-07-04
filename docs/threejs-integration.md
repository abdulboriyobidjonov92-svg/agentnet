# three.js integratsiya qo'llanmasi — Hero sahna + AgentOS Living Interface

Bu hujjat `apps/web` dagi barcha WebGL sahnalarning texnik qarorlarini,
sozlamalarini va kengaytirish yo'llarini qamrab oladi.

## 1. Umumiy arxitektura

| Sahna | Fayl | Vazifa |
|---|---|---|
| Landing hero atmosferasi | `components/hero/HeroCanvas.tsx` | Hologram aktyorlar + zarrachalar + pol (DOM ekranlar ORQASIDA) |
| Hologram aktyorlar | `components/hero/HologramActors.tsx` | Doctor / RetailOwner / LogisticsDrone |
| 3D qurilma meshlari | `components/hero/DeviceMock.tsx` | MacBook/iPhone/iPad (hozircha ishlatilmaydi — pastga qarang) |
| Neural Void | `components/features/AgentOS/NeuralBackground.tsx` | Shader zarracha maydoni (rol-morfi, kursor magniti) |
| Hologram Stage | `components/features/AgentOS/HologramActor.tsx` | Wireframe siluet + shader ovoz to'lqini |
| Umumiy o'ram | `components/three/scene-canvas.tsx` | dpr/perf byudjeti, `useLowPower`, `useReducedMotion` |

## 2. MUHIM arxitektura qarori: ekranlar DOM'da, 3D — atmosfera

Qurilma ekranlaridagi UI kontent (matn, grafik, tugma) **DOM qatlamida**
chiziladi (`FallbackHero` + `screens.tsx`), three.js esa orqada hologram/
zarracha/yorug'lik beradi. Sabablari:

1. **drei `<Html transform>` brauzerlararo mo'rt** — konteyner mount bo'lmasligi
   yoki noto'g'ri joylashishi kuzatildi; `Html` ichida React konteksti
   (i18n provider) ham mavjud emas (alohida React root).
2. **O'qilish mezoni**: DOM matni har qanday o'lchamda keskin, zoom/retina/
   screen-reader bilan muammosiz.
3. **Perf**: 3 ta katta `Html transform` har frame'da matritsa-sinxron
   bo'lishi kerak — DOM qatlamda bu bepul.

`DeviceMock.tsx` (to'liq 3D qurilma meshlari + Html ekranlar) repo'da
saqlanadi — kelajakda WebGL-ekranli versiya kerak bo'lsa, ekran kontentini
`THREE.CanvasTexture` bilan chizish tavsiya etiladi (Html transform emas).

## 3. Material va yorug'lik retsepti (PBR)

### Qurilma korpuslari (DeviceMock)
```ts
new THREE.MeshStandardMaterial({
  color: "#101318",   // grafit
  metalness: 0.75,    // aluminiy his
  roughness: 0.32,    // yumshoq spekulyar
})
```

### Pol (reflektiv "sahna")
```ts
new THREE.MeshStandardMaterial({ color: "#06070b", metalness: 0.65, roughness: 0.35 })
// Aks effekti: pol ustiga AdditiveBlending circleGeometry "glow disk"lar (opacity 0.05)
```

### Hologram materiali (barcha aktyorlar)
```ts
new THREE.MeshBasicMaterial({
  color, transparent: true, opacity: 0.22–0.5,
  blending: THREE.AdditiveBlending,  // yorug'lik "qo'shiladi"
  depthWrite: false,                  // orqa obyektlarni to'sib qo'ymaydi
  side: THREE.DoubleSide,
})
// + wireframe nusxa (opacity ~0.12–0.4) — "skanerlangan" hologram konturi
// + flicker: opacity *= 1 + sin(t*13)*0.06 + sin(t*37)*0.04 (useFrame'da)
```

### Rim light qiymatlari (hero)
```tsx
<ambientLight intensity={0.35} />
<pointLight position={[-6, 3.5, 2]} intensity={26} color="#2cc9e8" />  // chap cyan
<pointLight position={[ 6, 3,   1]} intensity={22} color="#2fbf8f" />  // o'ng emerald
<pointLight position={[ 0, 5,  -6]} intensity={14} color="#e8b04a" />  // orqa oltin rim
<pointLight position={[ 0, 1.4, 1.6]} intensity={8} color="#7ecfe8" /> // ekran nuri
```

## 4. Zarracha tizimi (NeuralBackground) — shader kontrakti

Bitta `<points>` + `ShaderMaterial`, bitta draw call. Uniformlar:

| Uniform | Turi | Vazifa |
|---|---|---|
| `uTime` | float | global vaqt |
| `uMouse` | vec3 | kursor world-pozitsiyasi (lerp bilan silliqlanadi) |
| `uSpeed` | float | rol tezligi (`ROLE_THEMES[role].particleSpeed`), inqirozda ×3.2 |
| `uChaos` | float | 0..1 — inqiroz amplitudasi |
| `uPulse` | float | nutq pulsi (sintetik audio-to'lqin) |
| `uColor/uColor2` | vec3 | rol ranglari (lerp — keskin sakrash yo'q) |

Magnit tortilish: `pull = smoothstep(6.0, 0.0, dist) * 1.6` — kursor atrofida
6 birlik radiusda kuchayadi. Audio pulsi mikrofonsiz **simulyatsiya**:
`speaking` holatida `|sin(9t)|*0.6 + |sin(23t)|*0.4`.

## 5. LOD / performans strategiyasi

- `dpr={[1, 1.5]}` — retinada ham 1.5 dan oshmaydi.
- `useLowPower()` (cores ≤ 4 yoki RAM ≤ 4GB): zarracha soni 14k → 4k,
  Sparkles 110 → 40.
- `useReducedMotion()`: three.js sahna UMUMAN mount bo'lmaydi — statik
  CSS gradient/DOM fallback ko'rsatiladi.
- WebGL yo'q muhit: `CinematicHero.useCanUse3D()` tekshiradi, DOM qatlam
  yolg'iz qoladi (funksional yo'qotish yo'q).
- Antialias: zarracha sahnasida `false` (AdditiveBlending baribir yumshatadi),
  hologram sahnasida `true`.
- Har frame'da allokatsiya yo'q: barcha `Vector3/Color` obyektlari `useRef`/
  `useMemo`da bir marta yaratiladi.
- 4K/Odyssey Ark: dpr chegarasi tufayli fragment yuki cheklangan; zarrachalar
  point-sprite (kvadratik emas) — fill-rate arzon.

## 6. Rol-morfing naqshi (Living Interface)

Rol almashganda hech narsa qayta mount qilinmaydi — faqat uniformlar lerp:
```ts
color.lerp(new THREE.Color(theme.particleColor), 1 - Math.exp(-3 * delta));
speed = THREE.MathUtils.damp(speed, theme.particleSpeed, 2.5, delta);
```
DOM qatlamda esa CSS o'zgaruvchilar (`--aos-accent` va h.k.) `main` style'ida
almashadi — `transition-colors duration-700` bilan silliq.

## 7. Kengaytirish retseptlari

- **Yangi hologram aktyor**: `HologramActors.tsx` naqshini oling —
  `holoMaterial()` + `HoloFloat` o'rami + geometriya primitivlari.
- **Yangi rol**: `store/agentStore.ts` → `ROLE_THEMES`ga yozuv qo'shing +
  `AdaptiveShell.tsx` → `RoleLayoutMap`ga vidjet ro'yxati. Boshqa hech narsa
  o'zgarmaydi (generativ layout).
- **Haqiqiy audio-puls**: `NeuralBackground`da `uPulse`ni WebAudio
  `AnalyserNode.getByteFrequencyData` o'rtachasiga ulang (mikrofon ruxsati
  talab qilinadi — hozircha ataylab simulyatsiya).
- **Haqiqiy rigged avatar**: `HologramActor.Silhouette` o'rniga glTF model
  (`useGLTF`) + `SkinnedMesh`; waveform va overlay o'z holicha qoladi.
