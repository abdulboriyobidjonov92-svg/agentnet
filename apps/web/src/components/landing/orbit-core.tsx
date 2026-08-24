"use client";

import { useRef, useState } from "react";
import { useAnimationFrame, useReducedMotion } from "framer-motion";
import { Brain, Code2, BarChart3, Cog, Eye, Link2, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";

/**
 * ORBITAL YADRO — landing'ning signature elementi.
 *
 * NEGA STATIK RASM EMAS: brend tasviri chiroyli, lekin u BIR NARSA ham
 * aytmaydi. Bu yerda oltita sfera mahsulotning oltita imkoniyati; ustiga
 * sichqoncha olib borilsa (yoki Tab bilan fokus berilsa) markazda o'sha
 * imkoniyat NIMA QILISHI yoziladi. Ya'ni hero — jonli imkoniyat xaritasi.
 *
 * PERSPEKTIVA: sferalar aylana bo'ylab emas, ELLIPS bo'ylab yuradi
 * (`RY = RX * 0.46`). Oldinga (pastga) kelgani kattaroq va yorqinroq,
 * orqaga (tepaga) ketgani kichrayadi va so'nadi. Shu tufayli tekis
 * aylana emas, chinakam orbita ko'rinadi.
 *
 * KONTEYNER KVADRAT EMAS: ellips balandligi kenglikning ~18% i, ya'ni
 * kvadrat qutida balandlikning yarmidan ko'pi BO'SH qolardi va hero
 * behuda cho'zilardi (o'lchandi: 1147px, CTA ekrandan pastda). Nisbat
 * 1.7:1 — ellips, sfera va yorliq aynan sig'adi.
 *
 * YORLIQLAR AYLANMAYDI: sfera pozitsiyasi `x/y` translyatsiya bilan
 * beriladi, aylantirish (`rotate`) UMUMAN ishlatilmaydi — shuning uchun
 * matn hech qachon ag'darilmaydi. Ko'p orbit-animatsiyalar aynan shu
 * joyda buziladi (aylantirib, keyin teskari aylantirishga urinadi).
 *
 * HARAKAT: `useAnimationFrame` DOM `style` ga to'g'ridan-to'g'ri yozadi,
 * React state'ga EMAS — kadr boshiga qayta render bo'lmaydi. (Motion
 * qiymatlari sikl ichida yaratilsa hooks qoidasi buzilardi, shuning
 * uchun oltita element uchun oddiy `ref` ishlatiladi.)
 * `prefers-reduced-motion` da halqa umuman qimirlamaydi; kompozitsiya
 * o'sha-o'sha go'zal holatda muzlaydi.
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
 * Ellipsning yassiligi EKRANGA QARAB o'zgaradi.
 *
 * Keng ekranda yassi ellips (0.46) chinakam orbita perspektivasini beradi.
 * Telefonda esa u SIQILADI: olti sfera tor gorizontal chiziqqa tizilib,
 * yorliqlari bir-birining ustiga chiqib ketadi (375px da o'lchandi).
 * Shuning uchun mobil'da orbita aylanaga yaqinlashadi — sferalar
 * vertikal bo'yicha ajraladi.
 */
const RY_WIDE = 0.46;
const RY_NARROW = 0.72;
const NARROW_PX = 420;

export function OrbitCore({ className = "" }: { className?: string }) {
  const { t } = useT();
  const reduced = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);

  const wrap = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useAnimationFrame((time) => {
    const el = wrap.current;
    if (!el) return;
    const w = el.clientWidth;
    const rx = (w / 2) * 0.78;
    const ry = rx * (w < NARROW_PX ? RY_NARROW : RY_WIDE);
    const spin = reduced ? 0 : (time / PERIOD_MS) * 360;

    NODES.forEach((n, i) => {
      const deg = n.base + spin;
      const rad = (deg * Math.PI) / 180;
      const x = Math.cos(rad) * rx;
      const y = Math.sin(rad) * ry;
      // Old tomon (y musbat) = yaqin. 0 -> uzoq, 1 -> yaqin.
      const depth = (Math.sin(rad) + 1) / 2;

      const node = nodeRefs.current[i];
      if (node) {
        node.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${(0.76 + depth * 0.24).toFixed(3)})`;
        node.style.opacity = (0.5 + depth * 0.5).toFixed(3);
        // Yaqindagi sfera markazdagi yozuv USTIDA, uzoqdagisi ORQASIDA.
        node.style.zIndex = depth > 0.5 ? "30" : "5";
      }

      // Yadrodan sferaga cho'zilgan yorug'lik chizig'i.
      const line = lineRefs.current[i];
      if (line) {
        const len = Math.hypot(x, y);
        line.style.width = `${len}px`;
        line.style.transform = `rotate(${Math.atan2(y, x)}rad)`;
        line.style.opacity = String(0.15 + depth * 0.5);
      }
    });
  });

  return (
    <div
      ref={wrap}
      className={`relative mx-auto aspect-[1.24/1] w-full max-w-[min(92vw,560px)] sm:aspect-[1.7/1] ${className}`}
    >
      {/* Orbita halqalari — uch konsentrik ellips, gradient chiziq bilan */}
      {/* Halqalar MARKAZDA SO'NADI: aks holda chiziq yadro ustidagi
          yozuvni kesib o'tadi va ikkalasi ham o'qilmay qoladi. */}
      {/* Halqalar FAQAT keng ekranda: ularning geometriyasi yassi ellipsga
          (0.46) qurilgan, mobil'da esa orbita aylanaga yaqin (0.72) — ya'ni
          chiziqlar sferalar yo'lidan chetda qolardi. Telefonda ular
          olib tashlanadi; sfera, yadro va nur chiziqlari yetarli. */}
      <svg
        viewBox="0 0 100 59"
        className="pointer-events-none absolute inset-0 hidden h-full w-full [mask-image:radial-gradient(ellipse_58%_58%_at_50%_50%,transparent_38%,black_72%)] sm:block"
        aria-hidden
      >
        <defs>
          <linearGradient id="orbit-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(258 100% 70%)" stopOpacity="0.55" />
            <stop offset="50%" stopColor="hsl(200 100% 65%)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="hsl(258 100% 70%)" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {[39, 30, 21].map((rx) => (
          <ellipse
            key={rx}
            cx="50"
            cy="29.5"
            rx={rx}
            ry={rx * RY_WIDE}
            fill="none"
            stroke="url(#orbit-ring)"
            strokeWidth="0.22"
          />
        ))}
      </svg>

      {/* YADRO — sahifadagi yagona yorug'lik manbai va ko'rinadigan JISM.
          Ilgari bu faqat tarqoq nur edi va markaz bo'sh ko'rinardi; endi
          ostida aniq qirrali sfera turadi, yozuv esa uning ustida. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-90 blur-[52px]"
        style={{
          background:
            "radial-gradient(circle, hsl(258 100% 64% / 0.95) 0%, hsl(232 100% 56% / 0.45) 42%, transparent 72%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[27%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 38% 26%, hsl(252 88% 38%) 0%, hsl(250 90% 20%) 55%, hsl(244 72% 9%) 100%)",
          boxShadow:
            "inset 0 1px 0 hsl(258 100% 85% / 0.35), 0 0 46px hsl(252 100% 60% / 0.55)",
        }}
      />

      {/* Yadrodan chiquvchi chiziqlar */}
      {NODES.map((n, i) => (
        <div
          key={`line-${n.id}`}
          ref={(el) => {
            lineRefs.current[i] = el;
          }}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-px origin-left"
          style={{
            background:
              "linear-gradient(90deg, hsl(258 100% 75% / 0.9) 0%, hsl(200 100% 70% / 0.35) 60%, transparent 100%)",
          }}
        />
      ))}

      {/* Markaz — brend belgisi va faol imkoniyat izohi */}
      <div className="absolute left-1/2 top-1/2 z-20 w-[62%] -translate-x-1/2 -translate-y-1/2 text-center">
        <p className="font-display text-[clamp(1.75rem,5.2vw,2.75rem)] font-bold leading-none tracking-[-0.04em]">
          <span className="text-white">Agent</span>
          <span className="bg-gradient-to-b from-[hsl(258_100%_78%)] to-[hsl(248_100%_62%)] bg-clip-text text-transparent">
            Net
          </span>
        </p>
        {/* Balandligi QAT'IY: yozuv almashganda kompozitsiya sakramaydi. */}
        {/* Telefonda YASHIRIN: teginish ekranida hover yo'q, va tor orbitada
            bu matn sferalar ustiga chiqib ketardi (375px da o'lchandi). */}
        <p className="mx-auto mt-4 hidden h-10 max-w-[15rem] items-center justify-center text-[0.75rem] leading-snug tracking-[0.01em] text-white/80 sm:flex">
          {active ? t(`orb.${active}Desc`) : t("orb.idle")}
        </p>
      </div>

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
            className="absolute left-1/2 top-1/2 -ml-7 -mt-7 will-change-transform"
          >
            <button
              type="button"
              onMouseEnter={() => setActive(n.id)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(n.id)}
              onBlur={() => setActive(null)}
              aria-label={`${t(`orb.${n.id}`)} — ${t(`orb.${n.id}Desc`)}`}
              className="group relative flex h-14 w-14 items-center justify-center rounded-full focus-visible:outline-none"
            >
              {/* Sfera: yuqoridan yorug', pastdan quyuq — yorug'lik yadrodan */}
              <span
                className={`absolute inset-0 rounded-full border transition-[box-shadow,border-color] duration-300 ${
                  isActive
                    ? "border-[hsl(258_100%_78%/0.9)] shadow-[0_0_28px_hsl(258_100%_62%/0.55)]"
                    : "border-white/15 shadow-[0_0_18px_hsl(248_100%_60%/0.25)]"
                } group-focus-visible:border-[hsl(190_100%_70%)] group-focus-visible:shadow-[0_0_0_2px_hsl(190_100%_70%/0.7)]`}
                style={{
                  background:
                    "radial-gradient(circle at 32% 24%, hsl(250 85% 42%) 0%, hsl(248 90% 22%) 55%, hsl(240 60% 10%) 100%)",
                }}
              />
              <Icon
                className={`relative h-5 w-5 transition-colors duration-300 ${
                  isActive ? "text-white" : "text-white/70"
                }`}
                aria-hidden
              />
            </button>

            {/* Yorliq — HECH QACHON aylanmaydi */}
            <span
              className={`pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap font-mono text-[0.5625rem] uppercase tracking-[0.22em] transition-colors duration-300 ${
                isActive ? "text-[hsl(258_100%_82%)]" : "text-white/40"
              }`}
            >
              {t(`orb.${n.id}`)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
