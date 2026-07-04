"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { SceneCanvas, useLowPower } from "@/components/three/scene-canvas";
import { MacBookMock, PhoneMock, TabletMock } from "./DeviceMock";
import { DoctorHologram, RetailOwnerHologram, LogisticsDrone } from "./HologramActors";
import { MacScreen, PhoneScreen, PadScreen } from "./screens";

/**
 * HeroCanvas — kirish sahnasi: MacBook markazda, iPhone chapda, iPad o'ngda,
 * ekranlardan hologram agentlar (Doctor / Retail Owner / Logistics Drone)
 * ko'tarilib turadi. Markaziy shar YO'Q (reference talabi).
 * Perf: dpr 1–1.5, past quvvatda kam zarracha, reduced-motion'da FallbackHero
 * ko'rsatiladi (bu komponent umuman mount bo'lmaydi).
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

      {/* Qurilmalar — reference kompozitsiyasi */}
      <MacBookMock position={[0, 0, 0]} screen={<MacScreen />} />
      <PhoneMock position={[-3.1, 0, 1.0]} rotation={[0, 0.45, 0]} screen={<PhoneScreen />} />
      <TabletMock position={[3.15, 0, 0.55]} rotation={[0, -0.5, 0]} screen={<PadScreen />} />

      {/* Hologram aktyorlar — ekranlardan ko'tariladi */}
      <DoctorHologram position={[-2.2, 1.15, -0.7]} />
      <RetailOwnerHologram position={[1.7, 1.2, -1.2]} />
      <LogisticsDrone position={[3.5, 2.4, -0.9]} />

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
