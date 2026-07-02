"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NEON, SceneCanvas } from "./scene-canvas";

/**
 * Rol-moslashuvchi 3D sahnalar — aniqlangan kasb bo'yicha dashboard
 * o'z "dunyosini" o'zgartiradi:
 *   healthcare   → pulslanuvchi hayot-orb + EKG chizig'i
 *   government   → 3D statistika ustunlari + suzuvchi hujjatlar
 *   agriculture  → shabada tebratayotgan maysa-konuslar + quyosh
 *   boshqalar    → kichik neyron yadro
 * (retail alohida: DOM'dagi scanline kamera-kartalari)
 */

function EcgLine() {
  const ref = useRef<THREE.Line>(null);
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 120; i++) pts.push(new THREE.Vector3((i / 120) * 6 - 3, 0, 0));
    return pts;
  }, []);
  const geom = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 2.2;
    const pos = geom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i <= 120; i++) {
      const x = i / 120;
      const phase = (x * 4 - t) % 1;
      let y = Math.sin(x * 12 + t) * 0.04;
      if (phase > 0 && phase < 0.08) y += Math.sin((phase / 0.08) * Math.PI) * 0.55; // QRS cho'qqisi
      pos.setY(i, y - 0.9);
    }
    pos.needsUpdate = true;
  });

  return (
    <primitive
      ref={ref}
      object={new THREE.Line(geom, new THREE.LineBasicMaterial({ color: NEON.emerald, transparent: true, opacity: 0.9 }))}
    />
  );
}

function HealthScene() {
  const orb = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!orb.current) return;
    const t = clock.elapsedTime;
    const beat = Math.pow(Math.max(0, Math.sin(t * 2.2)), 6) * 0.16; // yurak urishi
    orb.current.scale.setScalar(1 + beat);
    orb.current.rotation.y = t * 0.2;
  });
  return (
    <>
      <mesh ref={orb} position={[0, 0.35, 0]}>
        <icosahedronGeometry args={[0.8, 3]} />
        <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={0.5} roughness={0.3} wireframe />
      </mesh>
      <EcgLine />
    </>
  );
}

function GovScene() {
  const group = useRef<THREE.Group>(null);
  const bars = useMemo(() => [0.6, 1.1, 0.8, 1.5, 1.0, 1.8, 1.3], []);
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.25) * 0.25;
    group.current.children.forEach((child, i) => {
      if (child.userData.doc) child.position.y = 1.35 + Math.sin(clock.elapsedTime * 0.8 + i) * 0.12;
    });
  });
  const palette = [NEON.cyan, NEON.emerald, NEON.violet];
  return (
    <group ref={group}>
      {bars.map((h, i) => (
        <mesh key={i} position={[(i - 3) * 0.55, h / 2 - 1, 0]}>
          <boxGeometry args={[0.34, h, 0.34]} />
          <meshStandardMaterial
            color={palette[i % 3]}
            emissive={palette[i % 3]}
            emissiveIntensity={0.25}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}
      {[-1.1, 0.2, 1.3].map((x, i) => (
        <mesh key={`doc${i}`} position={[x, 1.35, 0.4]} rotation={[0, 0.3 * i, 0.05]} userData={{ doc: true }}>
          <planeGeometry args={[0.5, 0.65]} />
          <meshBasicMaterial color="#dbeafe" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function AgriScene() {
  const group = useRef<THREE.Group>(null);
  const blades = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        x: ((i % 12) - 5.5) * 0.5 + (Math.random() - 0.5) * 0.2,
        z: (Math.floor(i / 12) - 2) * 0.5,
        h: 0.5 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
      })),
    [],
  );
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.children.forEach((c, i) => {
      const b = blades[i];
      if (b) c.rotation.z = Math.sin(clock.elapsedTime * 1.2 + b.phase) * 0.14;
    });
  });
  return (
    <>
      <group ref={group}>
        {blades.map((b, i) => (
          <mesh key={i} position={[b.x, b.h / 2 - 1.1, b.z]}>
            <coneGeometry args={[0.05, b.h, 5]} />
            <meshStandardMaterial color={NEON.emerald} emissive={NEON.emerald} emissiveIntensity={0.2} />
          </mesh>
        ))}
      </group>
      {/* Quyosh */}
      <mesh position={[1.9, 1.15, -1]}>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshBasicMaterial color={NEON.gold} transparent opacity={0.9} />
      </mesh>
      <mesh position={[1.9, 1.15, -1]}>
        <sphereGeometry args={[0.62, 24, 24]} />
        <meshBasicMaterial color={NEON.gold} transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </>
  );
}

function MiniCore() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.3;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color={NEON.cyan} emissive={NEON.cyan} emissiveIntensity={0.3} wireframe />
    </mesh>
  );
}

export default function RoleScene({ domain, className }: { domain?: string | null; className?: string }) {
  const scene =
    domain === "healthcare" ? <HealthScene /> :
    domain === "government" || domain === "law" || domain === "finance" ? <GovScene /> :
    domain === "agriculture" ? <AgriScene /> :
    <MiniCore />;

  return (
    <SceneCanvas className={className} camera={{ position: [0, 0.4, 4.6], fov: 45 }}>
      <ambientLight intensity={0.6} />
      <pointLight position={[3, 3, 3]} intensity={30} color={NEON.cyan} />
      {scene}
    </SceneCanvas>
  );
}
