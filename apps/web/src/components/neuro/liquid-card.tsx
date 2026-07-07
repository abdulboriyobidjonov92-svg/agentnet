"use client";
// LIQUID CARD — "Dark Matter Glass" idishi.
// blur(40px) saturate(180%) + rgba(10,10,10,.6) + 1px rgba(255,255,255,.08).
// Kursorga qarab 3D perspektivada egiladi; shisha ustida spekulyar yaltirash
// kursorni kuzatib yuradi. framer-motion layout morflar bilan do'st.

import { forwardRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useMotionTemplate,
  useReducedMotion,
  type HTMLMotionProps,
} from "framer-motion";
import { cn } from "@/lib/utils";

interface LiquidCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children?: React.ReactNode;
  /** Egilish va spekulyar — interaktiv kartalar uchun */
  tilt?: boolean;
  /** Vena qirrasi — tirik/faol element belgisi */
  vein?: boolean;
  /** Egilish kuchi (gradus) */
  tiltStrength?: number;
}

export const LiquidCard = forwardRef<HTMLDivElement, LiquidCardProps>(
  function LiquidCard(
    { tilt = true, vein = false, tiltStrength = 7, className, children, style, ...rest },
    ref,
  ) {
    const reduced = useReducedMotion();
    const rx = useMotionValue(0);
    const ry = useMotionValue(0);
    const mx = useMotionValue(50);
    const my = useMotionValue(50);
    const srx = useSpring(rx, { stiffness: 160, damping: 18, mass: 0.6 });
    const sry = useSpring(ry, { stiffness: 160, damping: 18, mass: 0.6 });
    const specular = useMotionTemplate`radial-gradient(420px circle at ${mx}% ${my}%, rgba(255,255,255,0.065), transparent 55%)`;

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!tilt || reduced) return;
      const r = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width; // 0..1
      const py = (e.clientY - r.top) / r.height;
      rx.set((0.5 - py) * tiltStrength);
      ry.set((px - 0.5) * tiltStrength * 1.2);
      mx.set(px * 100);
      my.set(py * 100);
    };

    const onPointerLeave = () => {
      rx.set(0);
      ry.set(0);
    };

    return (
      <motion.div
        ref={ref}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        style={{
          rotateX: srx,
          rotateY: sry,
          transformPerspective: 1000,
          ...style,
        }}
        className={cn(
          "liquid-glass relative overflow-hidden rounded-3xl",
          vein && "vein-edge",
          className,
        )}
        {...rest}
      >
        {/* Spekulyar yaltirash — shishaning kursorga javobi */}
        {tilt && !reduced && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0"
            style={{ background: specular }}
          />
        )}
        <div className="relative z-[1] h-full">{children}</div>
      </motion.div>
    );
  },
);
