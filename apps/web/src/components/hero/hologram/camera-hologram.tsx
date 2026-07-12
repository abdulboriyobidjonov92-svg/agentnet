"use client";
import { useMemo } from "react";
import { CYAN, holoMaterial, HoloFloat } from "./primitives";

/** Kamera — reference'dagi yuqori kuzatuv/retail kamerasi */
export function CameraHologram({ position = [1.4, 3.3, -1.8] as [number, number, number] }) {
  const bodyMat = useMemo(() => holoMaterial(CYAN, 0.3), []);
  const wireMat = useMemo(() => {
    const m = holoMaterial(CYAN, 0.13);
    m.wireframe = true;
    return m;
  }, []);
  const lensMat = useMemo(() => holoMaterial("#9adfef", 0.55), []);

  return (
    <HoloFloat position={position} speed={1.1} materials={[bodyMat, wireMat, lensMat]}>
      <group rotation={[0, -0.4, 0]} scale={0.8}>
        <mesh material={bodyMat}>
          <boxGeometry args={[0.5, 0.3, 0.26]} />
        </mesh>
        <mesh material={wireMat}>
          <boxGeometry args={[0.53, 0.33, 0.29]} />
        </mesh>
        {/* Obyektiv */}
        <mesh position={[0.32, 0, 0]} rotation={[0, 0, -Math.PI / 2]} material={bodyMat}>
          <cylinderGeometry args={[0.11, 0.13, 0.16, 16]} />
        </mesh>
        <mesh position={[0.41, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={lensMat}>
          <circleGeometry args={[0.09, 16]} />
        </mesh>
      </group>
    </HoloFloat>
  );
}
