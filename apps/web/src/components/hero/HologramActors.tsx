"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";

/**
 * HologramActors — ekranlardan "chiqib kelayotgan" uch hologram aktyor:
 * Doctor (cyan), Retail Owner (emerald), Logistics Drone (cyan-gold).
 * Yarim shaffof additive materiallar, nozik flicker va suzish animatsiyasi.
 * Stilize qilingan (fotorealistik emas) — hologram estetikasi ataylab.
 */

const CYAN = "#38ddff";
const EMERALD = "#3ddba4";
const GOLD = "#f0b429";

function holoMaterial(color: string, opacity: number) {
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
function ProjectionBeam({ color, height = 2.2, radius = 0.75 }: { color: string; height?: number; radius?: number }) {
  const mat = useMemo(() => holoMaterial(color, 0.045), [color]);
  return (
    <mesh position={[0, height / 2, 0]} material={mat}>
      <coneGeometry args={[radius, height, 24, 1, true]} />
    </mesh>
  );
}

/** Umumiy hologram floating + flicker o'rami */
function HoloFloat({
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
