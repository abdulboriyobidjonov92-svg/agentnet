"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { SceneCanvas, useLowPower } from "@/components/three/scene-canvas";
import { DoctorHologram, RetailOwnerHologram, LogisticsDrone } from "./HologramActors";

/**
 * HeroCanvas — kirish sahnasining 3D atmosfera qatlami: hologram aktyorlar
 * (Doctor / Retail Owner / Logistics Drone), zarrachalar, pol va rim-lightlar.
 * Markaziy shar YO'Q (reference talabi).
 *
 * ARXITEKTURA QARORI: qurilma ekranlari (MacBook/iPhone/iPad) DOM qatlamida
 * chiziladi (DeviceRow / FallbackHero) — matn har doim keskin va o'qiladi,
 * i18n ishonchli ishlaydi. Canvas DOM orqasida atmosfera beradi. drei Html
 * transform rejimiga tayanmaymiz (brauzerlararo mo'rt). 3D qurilma meshlar
 * DeviceMock.tsx'da saqlanadi — kelajakdagi chuqur 3D versiya uchun.
 * Perf: dpr 1–1.5, past quvvatda kam zarracha, reduced-motion'da bu komponent
 * umuman mount bo'lmaydi.
 */

function CameraDrift() {
  const target = useRef(new THREE.Vector3(0, 1.1, 0));
  useFrame(({ camera, clock, pointer }) => {
    const t = clock.elapsedTime;
    // Sekin sinusli drift + kursor parallaksi (juda nozik)
    camera.position.x = Math.sin(t * 0.12) * 0.25 + pointer.x * 0.3;
    camera.position.y = 1.6 + Math.sin(t * 0.09) * 0.1 + pointer.y * 0.15;
    camera.lookAt(target.current);
  });
  return null;
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[40, 24]} />
      <meshStandardMaterial color="#06070b" metalness={0.65} roughness={0.35} />
    </mesh>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.35} />
      {/* Rim lightlar — chap cyan, o'ng emerald, orqadan iliq oltin */}
      <pointLight position={[-6, 3.5, 2]} intensity={26} color="#2cc9e8" />
      <pointLight position={[6, 3, 1]} intensity={22} color="#2fbf8f" />
      <pointLight position={[0, 5, -6]} intensity={14} color="#e8b04a" />
      {/* Ekranlardan chiqayotgan yorug'lik */}
      <pointLight position={[0, 1.4, 1.6]} intensity={8} color="#7ecfe8" />
    </>
  );
}

export default function HeroCanvas({ className }: { className?: string }) {
  const low = useLowPower();
  return (
    <SceneCanvas className={className} camera={{ position: [0, 1.6, 8.2], fov: 34 }}>
      <CameraDrift />
      <Lights />
      <Floor />

      {/* Hologram aktyorlar — DOM qurilma ekranlari ustidan ko'tariladi
          (x-pozitsiyalar DeviceRow joylashuviga mos: chap/markaz-o'ng/o'ng) */}
      <DoctorHologram position={[-2.6, 1.15, -0.7]} />
      <RetailOwnerHologram position={[1.9, 1.2, -1.2]} />
      <LogisticsDrone position={[3.6, 2.4, -0.9]} />

      {/* Fon zarrachalari — chuqur kosmik chang */}
      <Sparkles
        count={low ? 40 : 110}
        scale={[16, 7, 8]}
        position={[0, 2.6, -2]}
        size={1.6}
        speed={0.25}
        opacity={0.35}
        color="#9adfef"
      />
    </SceneCanvas>
  );
}
