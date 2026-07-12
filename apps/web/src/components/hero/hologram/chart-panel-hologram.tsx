"use client";
import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { EMERALD, holoMaterial, HoloFloat } from "./primitives";

/** Statistika paneli — reference'dagi o'ng tomondagi bar-chart + belgi */
export function ChartPanelHologram({ position = [4.3, 1.6, -1.6] as [number, number, number] }) {
  const frameMat = useMemo(() => holoMaterial(EMERALD, 0.2), []);
  const barMat = useMemo(() => holoMaterial(EMERALD, 0.5), []);
  const checkMat = useMemo(() => holoMaterial("#7CFC9B", 0.6), []);
  const bars = [0.16, 0.3, 0.22, 0.42, 0.34, 0.52];

  return (
    <HoloFloat position={position} speed={0.9} materials={[frameMat, barMat, checkMat]}>
      <group rotation={[0, -0.55, 0]}>
        {/* Panel romi */}
        <mesh material={frameMat}>
          <planeGeometry args={[1.0, 0.66]} />
        </mesh>
        {/* Barlar */}
        {bars.map((h, i) => (
          <mesh key={i} position={[-0.36 + i * 0.145, -0.28 + h / 2, 0.01]} material={barMat}>
            <planeGeometry args={[0.09, h]} />
          </mesh>
        ))}
        {/* Tasdiq belgisi — pastki panel */}
        <group position={[0, -0.55, 0]}>
          <mesh material={frameMat}>
            <planeGeometry args={[0.5, 0.3]} />
          </mesh>
          <Line
            points={[[-0.1, -0.02, 0.01], [-0.02, -0.09, 0.01], [0.12, 0.08, 0.01]]}
            color="#7CFC9B"
            lineWidth={2.5}
            transparent
            opacity={0.85}
          />
        </group>
      </group>
    </HoloFloat>
  );
}
