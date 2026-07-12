"use client";
import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { CYAN, holoMaterial, ProjectionBeam, HoloFloat } from "./primitives";

/** EKG chizig'i — doctor hologramining "yurak urishi" */
const EKG_POINTS: [number, number, number][] = [
  [-0.5, 0, 0], [-0.3, 0, 0], [-0.22, 0.1, 0], [-0.14, -0.14, 0],
  [-0.05, 0.3, 0], [0.04, -0.2, 0], [0.12, 0.06, 0], [0.2, 0, 0], [0.5, 0, 0],
];

export function DoctorHologram({ position = [-2.2, 1.15, -0.6] as [number, number, number] }) {
  const bodyMat = useMemo(() => holoMaterial(CYAN, 0.28), []);
  const wireMat = useMemo(() => {
    const m = holoMaterial(CYAN, 0.12);
    m.wireframe = true;
    return m;
  }, []);

  return (
    <group>
      <group position={[position[0], 0, position[2]]}>
        <ProjectionBeam color={CYAN} height={position[1] + 1.1} radius={0.65} />
      </group>
      <HoloFloat position={position} speed={1} materials={[bodyMat, wireMat]}>
        {/* Bosh */}
        <mesh position={[0, 0.78, 0]} material={bodyMat}>
          <sphereGeometry args={[0.2, 20, 16]} />
        </mesh>
        <mesh position={[0, 0.78, 0]} material={wireMat}>
          <sphereGeometry args={[0.22, 12, 10]} />
        </mesh>
        {/* Tana (xalat) */}
        <mesh position={[0, 0.28, 0]} material={bodyMat}>
          <cylinderGeometry args={[0.2, 0.4, 0.75, 18, 1, true]} />
        </mesh>
        <mesh position={[0, 0.28, 0]} material={wireMat}>
          <cylinderGeometry args={[0.22, 0.42, 0.78, 10, 2, true]} />
        </mesh>
        {/* Stetoskop halqasi */}
        <mesh position={[0, 0.52, 0.12]} rotation={[0.5, 0, 0]} material={bodyMat}>
          <torusGeometry args={[0.14, 0.015, 8, 24]} />
        </mesh>
        {/* EKG yurak chizig'i — ko'krak ustida */}
        <Line points={EKG_POINTS} color={CYAN} lineWidth={2} transparent opacity={0.85} position={[0, 0.3, 0.24]} scale={0.55} />
      </HoloFloat>
    </group>
  );
}
