"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EMERALD, holoMaterial, ProjectionBeam, HoloFloat } from "./primitives";

export function RetailOwnerHologram({ position = [1.7, 1.2, -1.1] as [number, number, number] }) {
  const boxMat = useMemo(() => holoMaterial(EMERALD, 0.3), []);
  const wireMat = useMemo(() => {
    const m = holoMaterial(EMERALD, 0.14);
    m.wireframe = true;
    return m;
  }, []);
  const ringMat = useMemo(() => holoMaterial(EMERALD, 0.4), []);
  const ring = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.6;
  });

  return (
    <group>
      <group position={[position[0], 0, position[2]]}>
        <ProjectionBeam color={EMERALD} height={position[1] + 0.9} radius={0.55} />
      </group>
      <HoloFloat position={position} speed={0.8} materials={[boxMat, wireMat, ringMat]}>
        {/* Do'kon egasi — bosh + tana */}
        <mesh position={[0, 0.72, 0]} material={boxMat}>
          <sphereGeometry args={[0.17, 18, 14]} />
        </mesh>
        <mesh position={[0, 0.3, 0]} material={boxMat}>
          <cylinderGeometry args={[0.18, 0.32, 0.6, 16, 1, true]} />
        </mesh>
        <mesh position={[0, 0.3, 0]} material={wireMat}>
          <cylinderGeometry args={[0.2, 0.34, 0.63, 8, 2, true]} />
        </mesh>
        {/* Inventar qutilari — qo'lida */}
        <mesh position={[0.3, 0.42, 0.08]} rotation={[0, 0.4, 0]} material={boxMat}>
          <boxGeometry args={[0.16, 0.16, 0.16]} />
        </mesh>
        <mesh position={[0.3, 0.6, 0.08]} rotation={[0, 0.2, 0]} material={wireMat}>
          <boxGeometry args={[0.13, 0.13, 0.13]} />
        </mesh>
        {/* Aylanuvchi savdo halqasi */}
        <mesh ref={ring} position={[0, 0.35, 0]} rotation={[Math.PI / 2.4, 0, 0]} material={ringMat}>
          <torusGeometry args={[0.5, 0.008, 8, 48]} />
        </mesh>
      </HoloFloat>
    </group>
  );
}
