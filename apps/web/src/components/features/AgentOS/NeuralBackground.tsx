"use client";
import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useLowPower, useReducedMotion } from "@/components/three/scene-canvas";
import { ROLE_THEMES, useAgentStore } from "./store/agentStore";

/**
 * NeuralBackground — "Neural Void": global ma'lumot oqimini ifodalovchi
 * zarracha maydoni. To'liq shader-asosli (bitta draw call):
 *   - kursorga magnit tortilish (uMouse)
 *   - rol o'zgarганda rang/tezlik morfi (lerp — keskin sakrash yo'q)
 *   - agent nutqi/inqiroz rejimida puls (uPulse/uChaos)
 * Audio-chastota pulsi SIMULYATSIYA qilinadi (mikrofon ruxsatisiz) —
 * `speaking` holatidan sintetik to'lqin hosil bo'ladi.
 * Perf: past quvvatda 4k, aks holda 14k zarracha; dpr 1–1.5; 60fps byudjet.
 */

const VERT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uMouse;
  uniform float uSpeed;
  uniform float uChaos;
  uniform float uPulse;
  attribute float aSeed;
  varying float vGlow;

  void main() {
    vec3 p = position;
    float s = aSeed * 6.2831;

    // Sekin organik drift — uch chastotali sinus maydon
    float t = uTime * uSpeed;
    p.x += sin(t * 0.7 + s + p.y * 0.15) * (0.6 + uChaos * 1.8);
    p.y += cos(t * 0.5 + s * 2.0 + p.x * 0.12) * (0.4 + uChaos * 1.4);
    p.z += sin(t * 0.6 + s * 3.0) * (0.5 + uChaos);

    // Kursorga magnit tortilish (radius ichida)
    vec3 toMouse = uMouse - p;
    float d = length(toMouse);
    float pull = smoothstep(6.0, 0.0, d) * 1.6;
    p += normalize(toMouse + 0.0001) * pull;

    vGlow = smoothstep(5.0, 0.5, d) + uPulse * 0.6;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = 2.2 + aSeed * 2.4 + uPulse * 2.0 + vGlow * 1.5;
    gl_PointSize = size * (28.0 / -mv.z);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uColor2;
  varying float vGlow;

  void main() {
    // Yumshoq dumaloq zarracha
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.05, length(c));
    vec3 col = mix(uColor2, uColor, clamp(vGlow, 0.0, 1.0));
    gl_FragColor = vec4(col, a * (0.35 + vGlow * 0.5));
  }
`;

function ParticleField() {
  const low = useLowPower();
  const count = low ? 4000 : 14000;
  const mat = useRef<THREE.ShaderMaterial>(null);
  const mouse3 = useRef(new THREE.Vector3(0, 0, 0));
  const colorA = useRef(new THREE.Color("#7fb8cc"));
  const colorB = useRef(new THREE.Color("#3d5a66"));
  const speedRef = useRef(0.35);
  const { camera, pointer } = useThree();

  const { positions, seeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Keng yassi hajm — kamera oldida "void" his qilinsin
      pos[i * 3] = (Math.random() - 0.5) * 46;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 26;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 18 - 4;
      sd[i] = Math.random();
    }
    return { positions: pos, seeds: sd };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector3(0, 0, 0) },
      uSpeed: { value: 0.35 },
      uChaos: { value: 0 },
      uPulse: { value: 0 },
      uColor: { value: new THREE.Color("#7fb8cc") },
      uColor2: { value: new THREE.Color("#3d5a66") },
    }),
    [],
  );

  useFrame(({ clock }, delta) => {
    if (!mat.current) return;
    const u = mat.current.uniforms;
    const { role, crisis, speaking } = useAgentStore.getState();
    const theme = ROLE_THEMES[role];

    u.uTime.value = clock.elapsedTime;

    // Kursor → z=0 tekislikka proyeksiya (magnit markazi)
    const v = new THREE.Vector3(pointer.x, pointer.y, 0.5).unproject(camera);
    const dir = v.sub(camera.position).normalize();
    const dist = -camera.position.z / dir.z;
    mouse3.current.copy(camera.position).addScaledVector(dir, dist);
    (u.uMouse.value as THREE.Vector3).lerp(mouse3.current, 1 - Math.exp(-6 * delta));

    // Rol morfi — rang va tezlik silliq lerp
    colorA.current.lerp(new THREE.Color(theme.particleColor), 1 - Math.exp(-3 * delta));
    colorB.current.lerp(new THREE.Color(theme.particleColor2), 1 - Math.exp(-3 * delta));
    (u.uColor.value as THREE.Color).copy(colorA.current);
    (u.uColor2.value as THREE.Color).copy(colorB.current);

    const targetSpeed = crisis ? theme.particleSpeed * 3.2 : theme.particleSpeed;
    speedRef.current = THREE.MathUtils.damp(speedRef.current, targetSpeed, 2.5, delta);
    u.uSpeed.value = speedRef.current;
    u.uChaos.value = THREE.MathUtils.damp(u.uChaos.value as number, crisis ? 1 : 0, 2.5, delta);

    // Sintetik "audio" puls — nutq paytida ikki chastotali to'lqin
    const t = clock.elapsedTime;
    const target = speaking ? Math.abs(Math.sin(t * 9)) * 0.6 + Math.abs(Math.sin(t * 23)) * 0.4 : 0;
    u.uPulse.value = THREE.MathUtils.damp(u.uPulse.value as number, target, 8, delta);
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={mat}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export function NeuralBackground({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) {
    // Statik gradient — harakat majburlanmaydi
    return (
      <div
        className={className}
        style={{
          background:
            "radial-gradient(80% 60% at 50% 40%, hsl(var(--aos-accent) / 0.08), transparent 70%), hsl(var(--aos-bg))",
        }}
        aria-hidden
      />
    );
  }
  return (
    <div className={className} aria-hidden>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 16], fov: 50 }}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <ParticleField />
      </Canvas>
    </div>
  );
}
