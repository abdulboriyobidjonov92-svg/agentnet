"use client";
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { NEON, SceneCanvas } from "./scene-canvas";

/**
 * Kelajak yo'llari — Life Twin what-if natijasining 3D vaqt chizig'i.
 * Markaziy "hozir" nuqtasidan bir necha kelajak yo'li shoxlanadi
 * (timeline davrlari). Yo'l ustiga borilganda o'sha davr bashorati
 * animatsiya bilan ochiladi.
 */

export interface TimelinePoint {
  period: string;
  projection: string;
}

function Branch({
  point,
  index,
  total,
  onHover,
  active,
}: {
  point: TimelinePoint;
  index: number;
  total: number;
  onHover: (i: number | null) => void;
  active: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const color = [NEON.cyan, NEON.emerald, NEON.violet, NEON.gold][index % 4];

  // Shoxlanuvchi egri chiziq: markazdan yuqori-o'ngga
  const { tube, endPos } = useMemo(() => {
    const spread = (index - (total - 1) / 2) * 0.9;
    const start = new THREE.Vector3(-2.6, 0, 0);
    const mid = new THREE.Vector3(-0.6, spread * 0.6, 0);
    const end = new THREE.Vector3(2.2, spread * 1.25, 0);
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    const tube = new THREE.TubeGeometry(curve, 40, 0.025, 8, false);
    return { tube, endPos: end };
  }, [index, total]);

  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.elapsedTime;
      ref.current.position.y = Math.sin(t * 0.8 + index) * 0.03;
    }
  });

  return (
    <group>
      <mesh geometry={tube}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 1.4 : 0.5}
          transparent
          opacity={active ? 1 : 0.6}
          toneMapped={false}
        />
      </mesh>
      {/* Yo'l oxiridagi bashorat tuguni */}
      <group ref={ref} position={endPos.toArray()}>
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation();
            onHover(index);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            onHover(null);
            document.body.style.cursor = "auto";
          }}
        >
          <sphereGeometry args={[active ? 0.2 : 0.14, 20, 20]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 2.2 : 1} toneMapped={false} />
        </mesh>
        <Html center distanceFactor={8} position={[0, 0.4, 0]} style={{ pointerEvents: "none" }}>
          <div
            style={{
              padding: active ? "8px 12px" : "3px 10px",
              borderRadius: 10,
              width: active ? 190 : "auto",
              whiteSpace: active ? "normal" : "nowrap",
              fontSize: active ? 12 : 12,
              fontWeight: 600,
              color: "#e8fdff",
              background: "rgba(8,12,24,0.9)",
              border: `1px solid ${color}66`,
              boxShadow: active ? `0 0 22px ${color}55` : "none",
              backdropFilter: "blur(8px)",
              transition: "all 0.25s",
            }}
          >
            <div style={{ color, fontWeight: 700 }}>{point.period}</div>
            {active && <div style={{ marginTop: 4, fontWeight: 400, lineHeight: 1.4 }}>{point.projection}</div>}
          </div>
        </Html>
      </group>
    </group>
  );
}

function NowNode() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2) * 0.12);
  });
  return (
    <group position={[-2.6, 0, 0]}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial color="#fff" emissive={NEON.cyan} emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      <Html center distanceFactor={8} position={[0, -0.5, 0]} style={{ pointerEvents: "none" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#7dd3fc", whiteSpace: "nowrap" }}>NOW</div>
      </Html>
    </group>
  );
}

export default function FutureTimeline({ points, className }: { points: TimelinePoint[]; className?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const list = useMemo(() => points.slice(0, 4), [points]);
  return (
    <SceneCanvas className={className} camera={{ position: [0, 0, 6.5], fov: 45 }}>
      <ambientLight intensity={0.6} />
      <pointLight position={[0, 3, 4]} intensity={26} color={NEON.cyan} />
      <NowNode />
      {list.map((p, i) => (
        <Branch key={i} point={p} index={i} total={list.length} onHover={setHover} active={hover === i} />
      ))}
    </SceneCanvas>
  );
}
