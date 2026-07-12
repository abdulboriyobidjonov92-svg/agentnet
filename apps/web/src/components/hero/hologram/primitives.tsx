"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Umumiy hologram primitivlari: material, proyeksiya nuri, suzish+flicker
 * o'rami. Har bir aktyor (Doctor/RetailOwner/CargoTruck/...) shulardan
 * foydalanadi — stilize (fotorealistik emas) hologram estetikasi ataylab.
 */

export const CYAN = "#38ddff";
export const EMERALD = "#3ddba4";
export const GOLD = "#f0b429";

export function holoMaterial(color: string, opacity: number) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** Ekrandan yuqoriga ko'tarilgan yorug'lik konusi (proyeksiya nuri) */
export function ProjectionBeam({ color, height = 2.2, radius = 0.75 }: { color: string; height?: number; radius?: number }) {
  const mat = useMemo(() => holoMaterial(color, 0.045), [color]);
  return (
    <mesh position={[0, height / 2, 0]} material={mat}>
      <coneGeometry args={[radius, height, 24, 1, true]} />
    </mesh>
  );
}

/** Umumiy hologram floating + flicker o'rami */
export function HoloFloat({
  children,
  position,
  speed = 1,
  materials,
}: {
  children: React.ReactNode;
  position: [number, number, number];
  speed?: number;
  materials: THREE.MeshBasicMaterial[];
}) {
  const group = useRef<THREE.Group>(null);
  const base = useRef(materials.map((m) => m.opacity));

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed;
    if (group.current) {
      group.current.position.y = position[1] + Math.sin(t * 0.9) * 0.07;
      group.current.rotation.y = Math.sin(t * 0.35) * 0.12;
    }
    // Hologram flicker — ikki chastotali nozik titrash
    const flicker = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 37) * 0.04;
    materials.forEach((m, i) => {
      m.opacity = base.current[i] * flicker;
    });
  });

  return (
    <group ref={group} position={position}>
      {children}
    </group>
  );
}
