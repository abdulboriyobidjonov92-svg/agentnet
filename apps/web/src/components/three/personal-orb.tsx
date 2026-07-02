"use client";
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, MeshDistortMaterial, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { AGENT_COLORS, NEON, SceneCanvas, useLowPower } from "./scene-canvas";

/**
 * Shaxsiy Orb — dashboard markazi, Life Twin'ning vizual langari.
 * Markazda "nafas oluvchi" suyuq orb; atrofida foydalanuvchi agentlari
 * har biri o'z rangi va tezligi bilan orbitada aylanadi.
 * Orb bosilsa — holat paneli; agent tuguni bosilsa — o'sha agent chati.
 */

export interface OrbAgent {
  id: string;
  name: string;
}

function AgentNode({
  agent,
  index,
  total,
  onSelect,
}: {
  agent: OrbAgent;
  index: number;
  total: number;
  onSelect?: (id: string) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const color = AGENT_COLORS[index % AGENT_COLORS.length];
  const radius = 2.5 + (index % 3) * 0.45;
  const speed = 0.25 + (index % 4) * 0.07;
  const phase = (index / total) * Math.PI * 2;
  const yTilt = ((index % 5) - 2) * 0.18;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * speed + phase;
    ref.current.position.set(Math.cos(t) * radius, Math.sin(t * 1.3) * 0.5 + yTilt, Math.sin(t) * radius);
    const s = hovered ? 1.5 : 1;
    ref.current.scale.lerp(new THREE.Vector3(s, s, s), 0.12);
  });

  return (
    <group
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(agent.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <mesh>
        <sphereGeometry args={[0.14, 20, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hovered ? 2.4 : 1.2} toneMapped={false} />
      </mesh>
      {/* Nur halqasi */}
      <mesh>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.25 : 0.12} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {hovered && (
        <Html center distanceFactor={7} style={{ pointerEvents: "none" }}>
          <div
            style={{
              padding: "6px 12px",
              borderRadius: 12,
              whiteSpace: "nowrap",
              fontSize: 13,
              fontWeight: 600,
              color: "#e8fdff",
              background: "rgba(8,12,24,0.85)",
              border: `1px solid ${color}55`,
              boxShadow: `0 0 18px ${color}44`,
              backdropFilter: "blur(8px)",
            }}
          >
            {agent.name}
          </div>
        </Html>
      )}
    </group>
  );
}

function Orb({ onOrbClick }: { onOrbClick?: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.rotation.y = t * 0.12;
    const s = 1 + Math.sin(t * 0.8) * 0.03 + (hovered ? 0.06 : 0);
    ref.current.scale.setScalar(s);
  });

  return (
    <group>
      <mesh
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          onOrbClick?.();
        }}
        onPointerOver={() => {
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <icosahedronGeometry args={[1.15, 24]} />
        <MeshDistortMaterial
          color={NEON.cyan}
          emissive={NEON.cyan}
          emissiveIntensity={0.35}
          roughness={0.15}
          metalness={0.4}
          distort={0.32}
          speed={1.6}
          transparent
          opacity={0.92}
        />
      </mesh>
      {/* Tashqi shisha qatlam */}
      <mesh scale={1.35}>
        <sphereGeometry args={[1.15, 32, 32]} />
        <meshBasicMaterial color={NEON.emerald} transparent opacity={0.045} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Ekvator halqa */}
      <mesh rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[1.9, 0.008, 8, 90]} />
        <meshBasicMaterial color={NEON.cyan} transparent opacity={0.3} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh rotation={[Math.PI / 1.8, 0.4, 0]}>
        <torusGeometry args={[2.55, 0.006, 8, 90]} />
        <meshBasicMaterial color={NEON.violet} transparent opacity={0.22} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

export default function PersonalOrb({
  agents,
  onSelectAgent,
  onOrbClick,
  className,
}: {
  agents: OrbAgent[];
  onSelectAgent?: (id: string) => void;
  onOrbClick?: () => void;
  className?: string;
}) {
  const low = useLowPower();
  const shown = useMemo(() => agents.slice(0, 6), [agents]);
  return (
    <SceneCanvas className={className} camera={{ position: [0, 0.6, 6.2], fov: 45 }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 4, 4]} intensity={40} color={NEON.cyan} />
      <pointLight position={[-4, -2, 3]} intensity={25} color={NEON.violet} />
      <Orb onOrbClick={onOrbClick} />
      {shown.map((a, i) => (
        <AgentNode key={a.id} agent={a} index={i} total={shown.length} onSelect={onSelectAgent} />
      ))}
      {/* Juda sekin fon zarrachalari */}
      <Sparkles count={low ? 40 : 90} scale={[10, 6, 6]} size={1.6} speed={0.18} opacity={0.5} color={NEON.cyan} />
    </SceneCanvas>
  );
}
