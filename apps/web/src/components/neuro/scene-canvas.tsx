"use client";
// KOINOT (SceneCanvas) — Liquid Obsidian fonining birinchi qatlami.
// 1) WebGL "Fog of War": domain-warp fbm tutun, kursor tezligiga reaksiya qiladi.
// 2) DOM Spotlight: foydalanuvchi kursori — qorong'udagi yagona fonar.
// Sof qora (#000) ustida yashaydi; hech qachon UI'dan yorqin bo'lmaydi.

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const FOG_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FOG_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uMouse;   // 0..1 (y pastdan)
  uniform float uVel;    // silliqlangan kursor tezligi
  uniform vec2 uRes;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = rot * p * 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float aspect = uRes.x / max(uRes.y, 1.0);
    vec2 uv = vUv;
    vec2 p = vec2(uv.x * aspect, uv.y) * 2.6;
    float t = uTime * 0.028;

    // Domain warp — tutunning "suyuq" burilishi
    vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
    vec2 r = vec2(
      fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 0.6),
      fbm(p + 3.0 * q + vec2(8.3, 2.8) - t * 0.4)
    );
    float f = fbm(p + 3.0 * r);
    float smoke = f * (0.5 + 0.5 * q.x);

    // Kursor bo'roni — tezlik tutunni uyg'otadi
    vec2 m = vec2(uMouse.x * aspect, uMouse.y);
    float md = distance(vec2(uv.x * aspect, uv.y), m);
    float stir = exp(-md * md * 10.0) * uVel;

    // Deyarli qora palitra: tutun — zulmatning bir tonga ochilishi xolos
    vec3 col = vec3(0.012, 0.013, 0.018) + smoke * vec3(0.026, 0.030, 0.042);
    col += stir * vec3(0.05, 0.10, 0.13) * (0.4 + smoke * 1.6);

    // Tutun tubidagi bioluminessent izlar (juda xira)
    col += vec3(0.008, 0.030, 0.040) * pow(r.y, 3.0) * 0.55;
    col += vec3(0.026, 0.012, 0.052) * pow(q.y, 3.0) * 0.45;

    // Chetlar mutlaq qorong'ulikka singiydi
    float vg = smoothstep(1.3, 0.3, length(uv - 0.5) * 1.7);
    col *= vg;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function FogPlane({ reduced }: { reduced: boolean }) {
  const size = useThree((s) => s.size);
  const mouse = useRef({ x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, vel: 0 });

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: FOG_VERTEX,
        fragmentShader: FOG_FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uMouse: { value: new THREE.Vector2(0.5, 0.5) },
          uVel: { value: 0 },
          uRes: { value: new THREE.Vector2(1, 1) },
        },
        depthWrite: false,
        depthTest: false,
      }),
    [],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const m = mouse.current;
      const nx = e.clientX / window.innerWidth;
      const ny = 1 - e.clientY / window.innerHeight;
      m.vel = Math.min(1.6, m.vel + Math.hypot(nx - m.tx, ny - m.ty) * 14);
      m.tx = nx;
      m.ty = ny;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state, delta) => {
    const m = mouse.current;
    const u = material.uniforms;
    if (!reduced) u.uTime.value += delta;
    // Silliq ergashish + tezlik so'nishi
    m.x += (m.tx - m.x) * Math.min(1, delta * 5);
    m.y += (m.ty - m.y) * Math.min(1, delta * 5);
    m.vel *= Math.max(0, 1 - delta * 2.2);
    u.uMouse.value.set(m.x, m.y);
    u.uVel.value = reduced ? 0 : m.vel;
    u.uRes.value.set(size.width, size.height);
  });

  return (
    <mesh frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

/** Kursor-fonar: yorug'lik dog'i DOM qatlamida (arzon va o'tkir). */
function Spotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x;
    let ty = y;
    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };
    const tick = () => {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      el.style.background =
        `radial-gradient(640px circle at ${x}px ${y}px, rgba(255,255,255,0.045), transparent 62%),` +
        `radial-gradient(240px circle at ${x}px ${y}px, hsl(var(--vein-cyan) / 0.05), transparent 70%)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[1]" />;
}

export default function SceneCanvas() {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-black">
        <Canvas
          gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
          dpr={[1, 1.5]}
          frameloop="always"
          orthographic
        >
          <FogPlane reduced={reduced} />
        </Canvas>
      </div>
      <Spotlight />
    </>
  );
}
