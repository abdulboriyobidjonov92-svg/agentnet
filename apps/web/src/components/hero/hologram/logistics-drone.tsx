"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CYAN, GOLD, holoMaterial, HoloFloat } from "./primitives";

export function LogisticsDrone({ position = [3.4, 2.3, -0.8] as [number, number, number] }) {
  const bodyMat = useMemo(() => holoMaterial(CYAN, 0.34), []);
  const goldMat = useMemo(() => holoMaterial(GOLD, 0.5), []);
  const rotorMat = useMemo(() => holoMaterial(CYAN, 0.16), []);
  const rotors = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (rotors.current) rotors.current.rotation.y = clock.elapsedTime * 14;
  });

  const arms: [number, number][] = [
    [-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28],
  ];

  return (
    <HoloFloat position={position} speed={1.4} materials={[bodyMat, goldMat, rotorMat]}>
      {/* Korpus */}
      <mesh material={bodyMat}>
        <boxGeometry args={[0.34, 0.1, 0.34]} />
      </mesh>
      {/* Yuk konteyneri — oltin urg'u */}
      <mesh position={[0, -0.14, 0]} material={goldMat}>
        <boxGeometry args={[0.18, 0.12, 0.18]} />
      </mesh>
      {/* Qanotlar + rotorlar */}
      <group ref={rotors}>
        {arms.map(([x, z], i) => (
          <group key={i} position={[x, 0.03, z]}>
            <mesh material={bodyMat}>
              <cylinderGeometry args={[0.015, 0.015, 0.05, 6]} />
            </mesh>
            <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} material={rotorMat}>
              <circleGeometry args={[0.14, 16]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* Skaner nuri pastga */}
      <mesh position={[0, -0.55, 0]} material={rotorMat}>
        <coneGeometry args={[0.22, 0.8, 16, 1, true]} />
      </mesh>
    </HoloFloat>
  );
}
