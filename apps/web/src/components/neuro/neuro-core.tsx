"use client";
// NEURO-CORE — tizimning "joni". Robot yuzi emas: xom energiya.
// Idle: 60bpm yurak urishi (lub-dub). Faol: ferrofluid tikanlari.
// Material: oniks qora, ichida bioluminessent venalar (cyan -> violet).

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cn } from "@/lib/utils";

// Ashima 3D simplex noise (public domain) — vertex va fragment uchun
const SNOISE = /* glsl */ `
  vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
  vec4 mod289(vec4 x){return x - floor(x * (1.0/289.0)) * 289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`;

const CORE_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uBeat;      // yurak zarbi konverti (0..1)
  uniform float uActivity;  // 0 = uyqu, 1 = gapirayotgan foydalanuvchi
  varying vec3 vNormal;
  varying vec3 vObj;
  varying float vDisp;
  ${SNOISE}
  void main() {
    vObj = position;
    // Asosiy "suyuq" shakl — sekin, og'ir to'lqin
    float base = snoise(normal * (1.7 + uActivity * 1.4) + uTime * (0.16 + uActivity * 0.9));
    // Ferrofluid tikanlari — faqat faol holatda, yuqori chastota, o'tkir cho'qqilar
    float spikes = pow(abs(snoise(normal * 6.5 + uTime * 2.4)), 3.0) * uActivity;
    float disp =
      base * (0.13 + 0.09 * uActivity) +
      spikes * 0.42 +
      uBeat * 0.05;
    vDisp = disp;
    vNormal = normalMatrix * normal;
    vec3 p = position * (1.0 + disp);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const CORE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uBeat;
  uniform float uActivity;
  varying vec3 vNormal;
  varying vec3 vObj;
  varying float vDisp;
  ${SNOISE}
  void main() {
    vec3 N = normalize(vNormal);
    // Qirra nuri (fresnel) — zulmatda shakl faqat qirralardan o'qiladi
    float fres = pow(1.0 - abs(N.z), 2.4);

    // Oniks tanasi
    vec3 col = vec3(0.010, 0.011, 0.016);

    // Bioluminessent venalar: noise iplari, cyan -> violet
    float vn = snoise(vObj * 3.2 + uTime * 0.22);
    float branch = snoise(vObj * 7.5 - uTime * 0.15);
    float vein = smoothstep(0.62, 0.98, abs(vn)) + smoothstep(0.78, 1.0, abs(branch)) * 0.5;
    float hue = snoise(vObj * 1.4 + uTime * 0.07) * 0.5 + 0.5;
    vec3 veinCol = mix(vec3(0.12, 0.85, 1.0), vec3(0.52, 0.32, 1.0), hue);

    // Zarb va faollik venalarni yoritadi; tikan uchlari cho'g'lanadi
    float glow = 0.5 + uBeat * 1.1 + uActivity * 1.6;
    col += vein * veinCol * glow * (0.4 + max(vDisp, 0.0) * 2.4);
    col += fres * mix(vec3(0.12, 0.19, 0.26), veinCol, 0.4) * (0.5 + uActivity * 0.7 + uBeat * 0.35);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function gauss(x: number, mu: number, sigma: number) {
  const d = (x - mu) / sigma;
  return Math.exp(-0.5 * d * d);
}

function CoreMesh({
  activity,
  reduced,
  onTap,
}: {
  activity: number;
  reduced: boolean;
  onTap?: () => void;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const level = useRef(0.05); // silliqlangan joriy faollik
  const burst = useRef(0); // bosishdan keyingi portlash
  const [hover, setHover] = useState(false);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CORE_VERTEX,
        fragmentShader: CORE_FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uBeat: { value: 0 },
          uActivity: { value: 0 },
        },
      }),
    [],
  );

  useEffect(() => {
    document.body.style.cursor = hover ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hover]);

  useFrame((state, delta) => {
    const u = material.uniforms;
    const t = state.clock.elapsedTime;
    u.uTime.value = reduced ? 0 : t;

    // 60bpm: sekundiga bitta "lub-dub"
    const phase = t % 1.0;
    const beat = gauss(phase, 0.0, 0.055) + gauss(phase, 0.2, 0.07) * 0.55;
    u.uBeat.value = reduced ? 0 : beat;

    // Faollik: tashqi signal + hover + bosish portlashi, prujinali silliqlash
    burst.current = Math.max(0, burst.current - delta * 0.9);
    const target = Math.min(1, Math.max(activity, hover ? 0.4 : 0, burst.current) + 0.05);
    level.current += (target - level.current) * Math.min(1, delta * 3.5);
    u.uActivity.value = reduced ? 0.1 : level.current;

    if (mesh.current && !reduced) {
      mesh.current.rotation.y += delta * (0.08 + level.current * 0.25);
      mesh.current.rotation.x = Math.sin(t * 0.11) * 0.15;
    }
  });

  return (
    <mesh
      ref={mesh}
      material={material}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      onClick={() => {
        burst.current = 1.1;
        onTap?.();
      }}
    >
      <icosahedronGeometry args={[1, 48]} />
    </mesh>
  );
}

/**
 * activity: 0..1 — tashqaridan boshqariladigan "jon" darajasi
 * (masalan, foydalanuvchi yozayotganda 1 ga ko'tariladi).
 */
export default function NeuroCore({
  activity = 0,
  onTap,
  className,
}: {
  activity?: number;
  onTap?: () => void;
  className?: string;
}) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className={cn("relative h-full w-full", className)}>
      {/* Yadro atrofidagi nafas oluvchi nur — DOM qatlamida (arzon) */}
      <div
        aria-hidden
        className="heartbeat pointer-events-none absolute inset-[8%] rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--vein-cyan) / 0.10), hsl(var(--vein-violet) / 0.05) 55%, transparent 75%)",
        }}
      />
      <Canvas
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 3.1], fov: 42 }}
      >
        <CoreMesh activity={activity} reduced={reduced} onTap={onTap} />
      </Canvas>
    </div>
  );
}
