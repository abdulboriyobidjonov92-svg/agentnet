"use client";
import { useMemo } from "react";
import { CYAN, GOLD, holoMaterial, HoloFloat } from "./primitives";

/** Yuk mashinasi — reference'dagi pastki-o'ng logistika fura (oltin-cyan) */
export function CargoTruckHologram({ position = [3.6, 0.5, 0.9] as [number, number, number] }) {
  const bodyMat = useMemo(() => holoMaterial(CYAN, 0.26), []);
  const wireMat = useMemo(() => {
    const m = holoMaterial(CYAN, 0.12);
    m.wireframe = true;
    return m;
  }, []);
  const goldMat = useMemo(() => holoMaterial(GOLD, 0.4), []);

  return (
    <HoloFloat position={position} speed={0.7} materials={[bodyMat, wireMat, goldMat]}>
      <group rotation={[0, -0.5, 0]} scale={0.85}>
        {/* Treyler */}
        <mesh position={[-0.35, 0.34, 0]} material={bodyMat}>
          <boxGeometry args={[1.15, 0.5, 0.45]} />
        </mesh>
        <mesh position={[-0.35, 0.34, 0]} material={wireMat}>
          <boxGeometry args={[1.18, 0.53, 0.48]} />
        </mesh>
        {/* Kabina */}
        <mesh position={[0.45, 0.26, 0]} material={goldMat}>
          <boxGeometry args={[0.38, 0.34, 0.42]} />
        </mesh>
        {/* G'ildiraklar */}
        {[-0.75, -0.15, 0.45].map((x) => (
          <mesh key={x} position={[x, 0.09, 0.2]} rotation={[Math.PI / 2, 0, 0]} material={bodyMat}>
            <torusGeometry args={[0.09, 0.03, 8, 18]} />
          </mesh>
        ))}
        {/* Faralar nuri */}
        <mesh position={[0.75, 0.2, 0]} rotation={[0, 0, -Math.PI / 2]} material={wireMat}>
          <coneGeometry args={[0.14, 0.5, 12, 1, true]} />
        </mesh>
      </group>
    </HoloFloat>
  );
}
