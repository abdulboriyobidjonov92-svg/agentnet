"use client";
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/components/three/scene-canvas";
import { ROLE_THEMES, useAgentStore } from "./store/agentStore";

/**
 * HologramActor — AI agent uchun "Hologram Stage".
 * Rigged 3D model yo'q — YUQORI SIFATLI PLACEHOLDER (halol yondashuv):
 *   - three.js geometriyadan yorug' wireframe siluet (bosh/tana/yelka)
 *   - shader-asosidagi ovoz to'lqini (nutq paytida animatsiya)
 *   - skan chizig'i va flicker — hologram estetikasi
 * "ACE LINK" indikatori — UI mockup holati (haqiqiy NVIDIA ACE ulanishi YO'Q;
 * ishlab chiqarishda haqiqiy holat API'dan keladi).
 */

function holo(color: string, opacity: number, wireframe = false) {
  const m = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  m.wireframe = wireframe;
  return m;
}

/** Wireframe inson silueti — bosh, bo'yin, yelka-ko'krak, qo'llar konturi */
function Silhouette() {
  const group = useRef<THREE.Group>(null);
  const mats = useRef<THREE.MeshBasicMaterial[]>([]);
  const scanRef = useRef<THREE.Mesh>(null);
  const color = useRef(new THREE.Color("#7fb8cc"));

  const materials = useMemo(() => {
    const solid = holo("#7fb8cc", 0.22);
    const wire = holo("#7fb8cc", 0.4, true);
    const scan = holo("#ffffff", 0.12);
    mats.current = [solid, wire, scan];
    return { solid, wire, scan };
  }, []);

  useFrame(({ clock }, delta) => {
    const { role, speaking } = useAgentStore.getState();
    const theme = ROLE_THEMES[role];
    const t = clock.elapsedTime;

    color.current.lerp(new THREE.Color(theme.particleColor), 1 - Math.exp(-3 * delta));
    mats.current.forEach((m) => m.color.copy(color.current));

    if (group.current) {
      group.current.position.y = Math.sin(t * 0.8) * 0.05 - 0.1;
      group.current.rotation.y = Math.sin(t * 0.3) * 0.15;
      // Nutqda siluet biroz "jonlanadi"
      const s = speaking ? 1 + Math.sin(t * 12) * 0.008 : 1;
      group.current.scale.setScalar(s);
    }
    // Hologram flicker
    const flicker = 1 + Math.sin(t * 17) * 0.08 + Math.sin(t * 41) * 0.05;
    materials.solid.opacity = 0.22 * flicker;
    materials.wire.opacity = 0.4 * flicker;

    // Skan chizig'i yuqoriga suzadi
    if (scanRef.current) {
      scanRef.current.position.y = ((t * 0.4) % 2.4) - 1.1;
    }
  });

  return (
    <group ref={group}>
      {/* Bosh */}
      <mesh position={[0, 0.95, 0]} material={materials.solid}>
        <sphereGeometry args={[0.3, 24, 18]} />
      </mesh>
      <mesh position={[0, 0.95, 0]} material={materials.wire}>
        <sphereGeometry args={[0.32, 14, 10]} />
      </mesh>
      {/* Bo'yin */}
      <mesh position={[0, 0.62, 0]} material={materials.solid}>
        <cylinderGeometry args={[0.09, 0.12, 0.22, 12]} />
      </mesh>
      {/* Ko'krak/yelka */}
      <mesh position={[0, 0.12, 0]} material={materials.solid}>
        <cylinderGeometry args={[0.4, 0.55, 0.9, 20, 1, true]} />
      </mesh>
      <mesh position={[0, 0.12, 0]} material={materials.wire}>
        <cylinderGeometry args={[0.42, 0.58, 0.94, 12, 3, true]} />
      </mesh>
      {/* Yelkalar */}
      <mesh position={[-0.5, 0.42, 0]} rotation={[0, 0, 0.5]} material={materials.solid}>
        <capsuleGeometry args={[0.11, 0.3, 4, 10]} />
      </mesh>
      <mesh position={[0.5, 0.42, 0]} rotation={[0, 0, -0.5]} material={materials.solid}>
        <capsuleGeometry args={[0.11, 0.3, 4, 10]} />
      </mesh>
      {/* Gorizontal skan chizig'i */}
      <mesh ref={scanRef} rotation={[-Math.PI / 2, 0, 0]} material={materials.scan}>
        <ringGeometry args={[0.0, 0.9, 32]} />
      </mesh>
      {/* Pastdagi proyeksiya halqasi */}
      <mesh position={[0, -1.05, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.wire}>
        <ringGeometry args={[0.5, 0.72, 48]} />
      </mesh>
    </group>
  );
}

/** Shader ovoz to'lqini — nutq amplitudasi bilan bar-vizualizator */
const WAVE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    float bars = 24.0;
    float x = floor(vUv.x * bars) / bars;
    // Har bar uchun psevdo-tasodifiy chastota
    float f = fract(sin(x * 91.17) * 43758.5) * 6.0 + 2.0;
    float h = (0.15 + abs(sin(uTime * f + x * 12.0)) * 0.85) * uAmp;
    float inBar = step(abs(vUv.y - 0.5) * 2.0, h) * step(fract(vUv.x * bars), 0.7);
    gl_FragColor = vec4(uColor, inBar * (0.25 + h * 0.75));
  }
`;

function VoiceWaveform() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: 0 },
      uColor: { value: new THREE.Color("#7fb8cc") },
    }),
    [],
  );

  useFrame(({ clock }, delta) => {
    if (!mat.current) return;
    const { role, speaking } = useAgentStore.getState();
    const u = mat.current.uniforms;
    u.uTime.value = clock.elapsedTime;
    u.uAmp.value = THREE.MathUtils.damp(u.uAmp.value as number, speaking ? 1 : 0.06, 6, delta);
    (u.uColor.value as THREE.Color).lerp(new THREE.Color(ROLE_THEMES[role].particleColor), 1 - Math.exp(-3 * delta));
  });

  return (
    <mesh position={[0, -1.45, 0.2]}>
      <planeGeometry args={[1.9, 0.34]} />
      <shaderMaterial
        ref={mat}
        fragmentShader={WAVE_FRAG}
        vertexShader={`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/** DOM overlay — ACE link status + subtitr */
function StageOverlay() {
  const role = useAgentStore((s) => s.role);
  const speaking = useAgentStore((s) => s.speaking);
  const speechText = useAgentStore((s) => s.speechText);
  const theme = ROLE_THEMES[role];

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
      {/* Yuqori status qatori */}
      <div className="flex items-center justify-between font-[family-name:var(--font-jetbrains)] text-[9px] uppercase tracking-[0.18em]">
        <span className="flex items-center gap-1.5 text-[hsl(var(--aos-accent))]">
          <motion.span
            className="inline-block h-1.5 w-1.5 rounded-full bg-current"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
          ACE LINK · SIM
        </span>
        <span className="text-white/40">60 FPS · LOD 2</span>
      </div>

      {/* Pastki qism: agent nomi + subtitr */}
      <div className="text-center">
        <p className="font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--aos-accent))]">
          {theme.agentName}
        </p>
        <AnimatePresence mode="wait">
          {speaking && (
            <motion.p
              key={speechText}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="mx-auto mt-1.5 max-w-[240px] text-xs leading-snug text-white/85"
            >
              “{speechText}”
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function HologramActor({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <div className={`relative ${className ?? ""}`}>
      {!reduced && (
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0.2, 4.2], fov: 38 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          style={{ background: "transparent" }}
          aria-hidden
        >
          <ambientLight intensity={0.6} />
          <Silhouette />
          <VoiceWaveform />
        </Canvas>
      )}
      <StageOverlay />
    </div>
  );
}
