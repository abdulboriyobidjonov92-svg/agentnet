"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NEON, SceneCanvas } from "./scene-canvas";

/**
 * Agent motifi — Agent Creator'ning jonli 3D ko'rinishi.
 * Agent sozlangani sari shakl "yig'iladi": har bir tanlangan vosita
 * markaz atrofida o'z motivini (ko'z=monitoring/bilim, kristall=moliya,
 * kitob=ta'lim/Qur'on, barg=qishloq xo'jaligi, ...) qo'shadi.
 */

type MotifKind = "eye" | "crystal" | "book" | "leaf" | "pulse" | "signal" | "clock" | "spark";

const TOOL_MOTIF: Record<string, { kind: MotifKind; color: string }> = {
  "knowledge.search": { kind: "eye", color: NEON.cyan },
  "islam.prayer_times": { kind: "book", color: NEON.emerald },
  "islam.quran_surah": { kind: "book", color: NEON.emerald },
  "health.symptom_check": { kind: "pulse", color: "#f43f5e" },
  "health.calorie_estimate": { kind: "pulse", color: "#f43f5e" },
  "finance.get_transactions": { kind: "crystal", color: NEON.gold },
  "finance.currency_rates": { kind: "crystal", color: NEON.gold },
  "utility.weather": { kind: "leaf", color: NEON.emerald },
  "calendar.get_events": { kind: "clock", color: NEON.violet },
  "messaging.telegram_send": { kind: "signal", color: NEON.blue },
};

function MotifShape({ kind, color }: { kind: MotifKind; color: string }) {
  const mat = <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} roughness={0.2} metalness={0.5} toneMapped={false} />;
  switch (kind) {
    case "crystal":
      return <mesh><octahedronGeometry args={[0.26, 0]} />{mat}</mesh>;
    case "book":
      return <mesh rotation={[0.3, 0.4, 0]}><boxGeometry args={[0.34, 0.26, 0.06]} />{mat}</mesh>;
    case "leaf":
      return <mesh rotation={[0, 0, 0.6]}><coneGeometry args={[0.16, 0.42, 5]} />{mat}</mesh>;
    case "pulse":
      return <mesh><torusGeometry args={[0.2, 0.06, 12, 24]} />{mat}</mesh>;
    case "signal":
      return <mesh rotation={[0.4, 0.4, 0]}><tetrahedronGeometry args={[0.28, 0]} />{mat}</mesh>;
    case "clock":
      return <mesh><torusGeometry args={[0.22, 0.03, 10, 28]} />{mat}</mesh>;
    case "eye":
      return (
        <group>
          <mesh><sphereGeometry args={[0.22, 20, 20]} />{mat}</mesh>
          <mesh position={[0, 0, 0.18]}><sphereGeometry args={[0.09, 16, 16]} /><meshBasicMaterial color="#04121a" /></mesh>
        </group>
      );
    default:
      return <mesh><icosahedronGeometry args={[0.22, 0]} />{mat}</mesh>;
  }
}

function OrbitingMotif({ tool, index, total }: { tool: string; index: number; total: number }) {
  const ref = useRef<THREE.Group>(null);
  const motif = TOOL_MOTIF[tool] ?? { kind: "spark" as MotifKind, color: NEON.cyan };
  const radius = 1.5;
  const phase = (index / Math.max(total, 1)) * Math.PI * 2;
  const speed = 0.4;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * speed + phase;
    ref.current.position.set(Math.cos(t) * radius, Math.sin(t * 1.5) * 0.35, Math.sin(t) * radius);
    ref.current.rotation.y = t * 1.5;
    ref.current.rotation.x = t;
    // yangi qo'shilganda "paydo bo'lish"
    const s = Math.min(1, ref.current.scale.x + 0.06);
    ref.current.scale.setScalar(s);
  });

  return (
    <group ref={ref} scale={0}>
      <MotifShape kind={motif.kind} color={motif.color} />
    </group>
  );
}

function Core({ active }: { active: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.rotation.y = t * 0.4;
    ref.current.rotation.x = Math.sin(t * 0.5) * 0.2;
    ref.current.scale.setScalar(1 + Math.sin(t * 1.2) * 0.04);
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.6, 1]} />
      <meshStandardMaterial
        color={active ? NEON.cyan : "#334155"}
        emissive={active ? NEON.cyan : "#1e293b"}
        emissiveIntensity={active ? 0.5 : 0.15}
        roughness={0.25}
        metalness={0.6}
        wireframe
      />
    </mesh>
  );
}

export default function AgentMotif({ tools, className }: { tools: string[]; className?: string }) {
  const list = useMemo(() => tools.slice(0, 9), [tools]);
  return (
    <SceneCanvas className={className} camera={{ position: [0, 0.3, 4.4], fov: 45 }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[3, 3, 3]} intensity={30} color={NEON.cyan} />
      <pointLight position={[-3, -2, 2]} intensity={18} color={NEON.violet} />
      <Core active={list.length > 0} />
      {list.map((tool, i) => (
        <OrbitingMotif key={tool} tool={tool} index={i} total={list.length} />
      ))}
    </SceneCanvas>
  );
}
