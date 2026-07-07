"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { SceneCanvas, useLowPower } from "@/components/three/scene-canvas";
import {
  DoctorHologram,
  RetailOwnerHologram,
  LogisticsDrone,
  CargoTruckHologram,
  CameraHologram,
  ChartPanelHologram,
} from "./HologramActors";

/**
 * HeroCanvas — kirish sahnasining 3D atmosfera qatlami (reference rasmlar):
 * markazda OBSIDIAN SHAR (tizim "joni"), atrofida hologram aktyorlar
 * (Doctor / Retail / Drone / Fura / Kamera / Statistika), zarrachalar, pol.
 *
 * ARXITEKTURA QARORI: qurilma ekranlari (MacBook/iPhone/iPad) DOM qatlamida
 * chiziladi (FallbackHero) — matn har doim keskin va o'qiladi, i18n va
 * havolalar ishonchli ishlaydi. Canvas DOM orqasida atmosfera beradi.
 * Perf: dpr 1–1.5, past quvvatda kam zarracha va kam aktyor,
 * reduced-motion'da bu komponent umuman mount bo'lmaydi.
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

/** Obsidian shar — reference 3-rasmdagi markaziy qora "jon" sferasi.
 *  Mat qora yuza rim-lightlardan qirrada cyan/emerald nur oladi. */
function ObsidianOrb({ position = [0, 3.0, -2.6] as [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!group.current) return;
    group.current.position.y = position[1] + Math.sin(t * 0.5) * 0.08;
    group.current.rotation.y = t * 0.06;
  });
  return (
    <group ref={group} position={position}>
      {/* Tana — mat oniks */}
      <mesh>
        <sphereGeometry args={[1.5, 64, 48]} />
        <meshStandardMaterial color="#0b0d12" metalness={0.68} roughness={0.38} />
      </mesh>
      {/* Orqa halo — sharni zulmatdan ajratib turadigan xira nur */}
      <mesh position={[0, 0, -0.4]}>
        <sphereGeometry args={[1.64, 32, 24]} />
        <meshBasicMaterial
          color="#1ba9c9"
          transparent
          opacity={0.07}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
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
      {/* Shar qirrasini chizadigan yo'nalishli nur (decay yo'q — doim ko'rinadi) */}
      <directionalLight position={[-3, 6, 2]} intensity={1.6} color="#8fd8ea" />
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

      {/* Markaziy obsidian shar — reference 3 */}
      <ObsidianOrb />

      {/* Hologram aktyorlar — DOM qurilma ekranlari atrofida
          (x-pozitsiyalar DeviceRow joylashuviga mos: chap/markaz-o'ng/o'ng) */}
      <DoctorHologram position={[-2.6, 1.15, -0.7]} />
      <RetailOwnerHologram position={[2.2, 1.2, -1.2]} />
      <LogisticsDrone position={[-1.2, 3.1, -1.4]} />
      {!low && (
        <>
          <CargoTruckHologram position={[3.7, 0.35, 0.9]} />
          <CameraHologram position={[1.5, 3.4, -1.8]} />
          <ChartPanelHologram position={[4.4, 1.7, -1.6]} />
        </>
      )}

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
