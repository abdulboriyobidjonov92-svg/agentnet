"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NEON, SceneCanvas, useLowPower } from "./scene-canvas";

/**
 * Neyron sfera — kirish ekranining markazi.
 * Fibonachchi sferasidagi yorug' nuqtalar + yaqin qo'shnilar orasidagi
 * ingichka chiziqlar; sekin aylanadi, nuqtalar yumshoq pulsatsiya qiladi.
 */

function fibonacciSphere(count: number, radius: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    pts.push(new THREE.Vector3(Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius));
  }
  return pts;
}

function NeuralCore({ pointCount, radius = 2.2 }: { pointCount: number; radius?: number }) {
  const group = useRef<THREE.Group>(null);

  const { positions, colors, linePositions } = useMemo(() => {
    const pts = fibonacciSphere(pointCount, radius);
    const positions = new Float32Array(pts.length * 3);
    const colors = new Float32Array(pts.length * 3);
    const palette = [new THREE.Color(NEON.cyan), new THREE.Color(NEON.emerald), new THREE.Color(NEON.violet)];
    pts.forEach((p, i) => {
      positions.set([p.x, p.y, p.z], i * 3);
      const c = palette[i % 3 === 0 ? 0 : i % 7 === 0 ? 2 : i % 2];
      colors.set([c.r, c.g, c.b], i * 3);
    });

    // Yaqin qo'shnilarni bog'lash (segmentlar soni cheklangan)
    const maxDist = radius * 0.55;
    const segments: number[] = [];
    let count = 0;
    const maxSegments = pointCount * 2;
    for (let i = 0; i < pts.length && count < maxSegments; i++) {
      for (let j = i + 1; j < Math.min(i + 12, pts.length) && count < maxSegments; j++) {
        if (pts[i].distanceTo(pts[j]) < maxDist) {
          segments.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
          count++;
        }
      }
    }
    return { positions, colors, linePositions: new Float32Array(segments) };
  }, [pointCount, radius]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.rotation.y = t * 0.08;
    group.current.rotation.x = Math.sin(t * 0.15) * 0.12;
    const s = 1 + Math.sin(t * 0.6) * 0.015;
    group.current.scale.setScalar(s);
  });

  return (
    <group ref={group}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.055} vertexColors transparent opacity={0.95} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={NEON.cyan} transparent opacity={0.14} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      {/* Ichki yadro nuri */}
      <mesh>
        <sphereGeometry args={[radius * 0.35, 24, 24]} />
        <meshBasicMaterial color={NEON.cyan} transparent opacity={0.05} />
      </mesh>
    </group>
  );
}

export default function NeuralSphere({ className }: { className?: string }) {
  const low = useLowPower();
  return (
    <SceneCanvas className={className} camera={{ position: [0, 0, 5.5], fov: 45 }}>
      <ambientLight intensity={0.4} />
      <NeuralCore pointCount={low ? 220 : 420} />
    </SceneCanvas>
  );
}
