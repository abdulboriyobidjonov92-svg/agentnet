"use client";
import dynamic from "next/dynamic";

/**
 * Kirish ekrani vizuali: aylanuvchi neyron sfera + zarrachali logotip.
 * three.js faqat klientda, faqat shu sahnada yuklanadi (dynamic, ssr:false).
 */
const NeuralSphere = dynamic(() => import("./neural-sphere"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-breathe rounded-full bg-primary/5 blur-3xl" />,
});
const ParticleWordmark = dynamic(() => import("./particle-wordmark"), { ssr: false });

export function HeroSphere({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <NeuralSphere className="!h-full !w-full" />
    </div>
  );
}

export function HeroWordmark({ className }: { className?: string }) {
  return <ParticleWordmark className={className ?? "h-[120px] w-full max-w-[560px]"} />;
}
