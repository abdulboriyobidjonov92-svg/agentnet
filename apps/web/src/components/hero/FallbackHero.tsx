"use client";
import { useT } from "@/lib/i18n/client";
import { MacScreen, PhoneScreen, PadScreen } from "./screens";

/**
 * FallbackHero — canvas yuklanmasa / reduced-motion / WebGL yo'q holat uchun
 * CSS-only kompozitsiya: xuddi shu uch qurilma ekrani perspective transform
 * bilan, statik hologram-glow fon. Hech qanday animatsiya majburlanmaydi.
 */
export default function FallbackHero({ className }: { className?: string }) {
  const { t } = useT();
  return (
    <div className={`relative overflow-hidden ${className ?? ""}`} aria-hidden>
      {/* Statik hologram glowlar */}
      <div className="absolute left-[14%] top-[8%] h-40 w-28 rounded-full bg-[hsl(var(--accent-cyan)/0.10)] blur-3xl" />
      <div className="absolute right-[30%] top-[4%] h-36 w-32 rounded-full bg-[hsl(var(--accent-emerald)/0.10)] blur-3xl" />
      <div className="absolute right-[8%] top-[12%] h-24 w-24 rounded-full bg-[hsl(var(--cta-gold)/0.08)] blur-3xl" />

      <div
        className="mx-auto flex max-w-5xl items-end justify-center gap-4 px-4 pb-10 pt-6"
        style={{ perspective: "1400px" }}
      >
        {/* iPhone — chap */}
        <div
          className="glass-panel edge-cyan hidden w-[150px] shrink-0 overflow-hidden rounded-2xl sm:block"
          style={{ transform: "rotateY(18deg) translateZ(0)", height: 320 }}
        >
          <PhoneScreen t={t} />
        </div>

        {/* MacBook — markaz */}
        <div className="w-full max-w-[560px]">
          <div
            className="glass-panel edge-cyan overflow-hidden rounded-t-xl"
            style={{ transform: "rotateX(4deg)", height: 320 }}
          >
            <MacScreen t={t} />
          </div>
          {/* Klaviatura bazasi */}
          <div className="mx-auto h-3 w-[112%] max-w-[620px] -translate-x-[5.5%] rounded-b-xl bg-[#101318] shadow-[0_10px_30px_rgba(0,0,0,0.6)]" />
        </div>

        {/* iPad — o'ng */}
        <div
          className="glass-panel edge-emerald hidden w-[240px] shrink-0 overflow-hidden rounded-2xl md:block"
          style={{ transform: "rotateY(-18deg) translateZ(0)", height: 260 }}
        >
          <PadScreen t={t} />
        </div>
      </div>

      {/* Pol aksi */}
      <div className="hero-floor-reflection absolute inset-x-0 bottom-0 h-16" />
    </div>
  );
}
