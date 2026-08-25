"use client";

import { useRef, useState } from "react";
import { useAnimationFrame, useReducedMotion } from "framer-motion";
import { Brain, Code2, BarChart3, Cog, Eye, Link2, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { GlobeCanvas } from "./globe-canvas";

/**
 * ORBITAL YADRO — landing'ning signature elementi.
 *
 * Markazda tirik sayyora (`globe-canvas.tsx`), atrofida oltita imkoniyat
 * sferasi ellips bo'ylab aylanadi. Sferaga sichqoncha kelsa yoki Tab
 * bilan fokus berilsa, orbitadan pastda o'sha imkoniyat NIMA QILISHI
 * yoziladi — ya'ni bu rasm emas, jonli imkoniyat xaritasi.
 *
 * PERSPEKTIVA: sferalar aylana emas, ELLIPS bo'ylab yuradi. Oldinga
 * (pastga) kelgani kattaroq va yorqinroq, orqaga ketgani kichrayadi va
 * so'nadi; `z-index` ham chuqurlikka qarab o'zgaradi.
 *
 * YORLIQLAR ALOHIDA QATLAMDA: ular aylanmaydi va sfera bilan birga
 * kichraymaydi. Joylashuvi — sferadan TASHQARIGA, markazdan qarama-qarshi
 * yo'nalishga (referensdagi kabi: yon sferalarniki yonida, tepa va
 * pastdagilarniki ustida/ostida). Konteyner chetidan chiqib ketmasligi
 * uchun gorizontal bo'yicha qisiladi.
 *
 * HARAKAT: `useAnimationFrame` DOM `style` ga to'g'ridan-to'g'ri yozadi,
 * React state'ga emas — kadr boshiga qayta render bo'lmaydi.
 * `prefers-reduced-motion` da halqa qimirlamaydi.
 */

interface Node {
  id: string;
  Icon: LucideIcon;
  /** Boshlang'ich burchak (gradus) — soat mili bo'yicha, tepadan. */
  base: number;
}

// Tartib brend tasviridan: tepada INTELLIGENCE, so'ng soat mili bo'yicha.
const NODES: Node[] = [
  { id: "intelligence", Icon: Brain, base: -90 },
  { id: "code", Icon: Code2, base: -30 },
  { id: "analytics", Icon: BarChart3, base: 30 },
  { id: "automation", Icon: Cog, base: 90 },
  { id: "vision", Icon: Eye, base: 150 },
  { id: "connectors", Icon: Link2, base: 210 },
];

/** Bitta to'liq aylanish — 72 s. Sekinlik qimmat ko'rinadi; tez aylanish arzon. */
const PERIOD_MS = 72_000;

/**
 * Ellipsning yassiligi EKRANGA QARAB o'zgaradi: keng ekranda yassiroq
 * ellips orbita perspektivasini beradi, telefonda esa u siqilib
 * sferalarni bir chiziqqa tizib qo'yardi.
 */
const RY_WIDE = 0.72;
const RY_NARROW = 0.78;
const NARROW_PX = 420;

/** Sfera markazining orbita radiusi (konteyner yarim kengligiga nisbatan). */
const ORBIT_K = 0.74;
/** Sayyora kengligi konteynerga nisbatan; canvas ichida R = shuning 0.34 i. */
const GLOBE_W_NARROW = 0.52;
const GLOBE_W_WIDE = 0.62;

export function OrbitCore({ className = "" }: { className?: string }) {
  const { t } = useT();
  const reduced = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);

  const wrap = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useAnimationFrame((time) => {
    const el = wrap.current;
    if (!el) return;
    const w = el.clientWidth;
    const narrow = w < NARROW_PX;
    const rx = (w / 2) * ORBIT_K;
    const ry = rx * (narrow ? RY_NARROW : RY_WIDE);
    const spin = reduced ? 0 : (time / PERIOD_MS) * 360;
    const sphereR = narrow ? 28 : 32;
    const globeR = w * (narrow ? GLOBE_W_NARROW : GLOBE_W_WIDE) * 0.34;

    NODES.forEach((n, i) => {
      const rad = ((n.base + spin) * Math.PI) / 180;
      const x = Math.cos(rad) * rx;
      const y = Math.sin(rad) * ry;
      // Old tomon (y musbat) = yaqin. 0 -> uzoq, 1 -> yaqin.
      const depth = (Math.sin(rad) + 1) / 2;

      const node = nodeRefs.current[i];
      if (node) {
        node.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${(0.8 + depth * 0.2).toFixed(3)})`;
        node.style.opacity = (0.62 + depth * 0.38).toFixed(3);
        node.style.zIndex = depth > 0.5 ? "30" : "5";
      }

      // Nur chizig'i sayyora CHEKKASIDAN sfera chetigacha.
      // Markazdan boshlansa oltita chiziq sayyorani kesib o'tib,
      // markazda "pirog bo'laklari" hosil qilardi.
      const line = lineRefs.current[i];
      if (line) {
        const len = Math.hypot(x, y);
        const start = globeR + 2;
        line.style.width = `${Math.max(len - start - sphereR + 6, 0)}px`;
        line.style.transform = `rotate(${Math.atan2(y, x)}rad) translateX(${start}px)`;
        line.style.opacity = (0.3 + depth * 0.7).toFixed(3);
      }

      // Yorliq sferadan TASHQARIGA qo'yiladi: pastki yarimda ostiga,
      // YUQORI YARIMDA USTIGA.
      //
      // ⚠️ Ilgari u har doim ostida turardi va tepadagi sfera uchun bu
      // yorliqni to'g'ri sayyora ustiga tushirardi (skrinshotda
      // "AVTOMATLASHTIRISH" globus ustida edi). Sferaning globusga
      // tegmasligini tekshirgan test buni ushlamagan — u sferani
      // o'lchagan, yorliqni emas.
      const label = labelRefs.current[i];
      if (label) {
        const gap = sphereR + (narrow ? 13 : 16);
        const above = y < 0;
        const ly = above ? y - gap : y + gap;
        const maxX = w / 2 - label.offsetWidth / 2 - 4;
        const lx = Math.max(-maxX, Math.min(maxX, x));
        label.style.transform =
          `translate(-50%, ${above ? "-100%" : "0"}) translate(${lx}px, ${ly}px)`;
        label.style.opacity = (0.55 + depth * 0.45).toFixed(3);
      }
    });
  });

  return (
    <div className={className}>
      <div
        ref={wrap}
        className="relative mx-auto aspect-[1.08/1] w-full max-w-[min(92vw,580px)] sm:aspect-[1.28/1]"
      >
        {/* Orbita halqalari — faqat keng ekranda: mobil'da ellips nisbati
            boshqa va chiziqlar sferalar yo'lidan chetda qolardi. */}
        <svg
          viewBox="0 0 100 78"
          className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block"
          aria-hidden
        >
          <defs>
            <linearGradient id="orbit-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(222 100% 78%)" stopOpacity="0.55" />
              <stop offset="50%" stopColor="hsl(250 100% 78%)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="hsl(222 100% 78%)" stopOpacity="0.07" />
            </linearGradient>
          </defs>
          {[37, 30, 23].map((r) => (
            <ellipse
              key={r}
              cx="50"
              cy="39"
              rx={r}
              ry={r * RY_WIDE}
              fill="none"
              stroke="url(#orbit-ring)"
              strokeWidth="0.24"
            />
          ))}
        </svg>

        {/* Tirik sayyora */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[52%] -translate-x-1/2 -translate-y-1/2 sm:w-[62%]">
          <GlobeCanvas />
        </div>

        {/* Sayyoradan sferalarga cho'zilgan nur chiziqlari */}
        {NODES.map((n, i) => (
          <div
            key={`line-${n.id}`}
            ref={(el) => {
              lineRefs.current[i] = el;
            }}
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[1.5px] origin-left rounded-full"
            style={{
              background:
                "linear-gradient(90deg, hsl(215 100% 85% / 0.9) 0%, hsl(245 100% 82% / 0.6) 55%, hsl(250 100% 82% / 0.25) 100%)",
              boxShadow: "0 0 10px hsl(232 100% 70% / 0.55)",
            }}
          />
        ))}

        {/* Sferalar */}
        {NODES.map((n, i) => {
          const { Icon } = n;
          const isActive = active === n.id;
          return (
            <div
              key={n.id}
              ref={(el) => {
                nodeRefs.current[i] = el;
              }}
              className="absolute left-1/2 top-1/2 -ml-7 -mt-7 will-change-transform sm:-ml-8 sm:-mt-8"
            >
              <button
                type="button"
                onMouseEnter={() => setActive(n.id)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(n.id)}
                onBlur={() => setActive(null)}
                aria-label={`${t(`orb.${n.id}`)} — ${t(`orb.${n.id}Desc`)}`}
                className="group relative flex h-14 w-14 items-center justify-center rounded-full focus-visible:outline-none sm:h-16 sm:w-16"
              >
                {/* KONTUR HALQA — to'ldirilgan shar emas (referens shunday):
                    ichi deyarli shaffof, chekkasi yupqa yorug' chiziq,
                    tashqarisida yumshoq nur. */}
                <span
                  className={`absolute inset-0 rounded-full border transition-[box-shadow,border-color,background-color] duration-300 ${
                    isActive
                      ? "border-[hsl(210_100%_86%/0.95)] bg-[hsl(226_60%_16%/0.85)] shadow-[0_0_34px_hsl(232_100%_66%/0.6),inset_0_0_18px_hsl(228_100%_70%/0.25)]"
                      : "border-[hsl(220_80%_78%/0.55)] bg-[hsl(226_55%_12%/0.72)] shadow-[0_0_22px_hsl(230_100%_60%/0.35),inset_0_0_14px_hsl(228_100%_70%/0.12)]"
                  } group-focus-visible:border-[hsl(190_100%_75%)] group-focus-visible:shadow-[0_0_0_2px_hsl(190_100%_70%/0.8)]`}
                />
                <Icon
                  className={`relative h-5 w-5 transition-colors duration-300 sm:h-6 sm:w-6 ${
                    isActive ? "text-white" : "text-[hsl(215_90%_88%)]"
                  }`}
                  aria-hidden
                />
              </button>
            </div>
          );
        })}

        {/* Yorliqlar — alohida qatlam (aylanmaydi, kichraymaydi) */}
        {NODES.map((n, i) => (
          <span
            key={`label-${n.id}`}
            ref={(el) => {
              labelRefs.current[i] = el;
            }}
            aria-hidden
            className={`pointer-events-none absolute left-1/2 top-1/2 z-40 whitespace-nowrap font-mono text-[0.5rem] uppercase tracking-[0.14em] transition-colors duration-300 sm:text-[0.5625rem] sm:tracking-[0.24em] ${
              active === n.id ? "text-white" : "text-white/65"
            }`}
          >
            {t(`orb.${n.id}`)}
          </span>
        ))}
      </div>

      {/* Faol imkoniyat izohi — orbitadan pastda (markazni endi sayyora
          egallaydi). Balandligi QAT'IY: yozuv almashganda sahifa sakramaydi. */}
      <p
        aria-live="polite"
        className="mx-auto mt-5 flex h-10 max-w-md items-center justify-center px-4 text-center text-[0.8125rem] leading-snug text-white/70"
      >
        {active ? t(`orb.${active}Desc`) : t("orb.idle")}
      </p>
    </div>
  );
}
