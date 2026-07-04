"use client";
import { useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Html } from "@react-three/drei";
import * as THREE from "three";

/**
 * DeviceMock — MacBook / iPhone / iPad 3D mockuplari.
 * Ekran kontenti DOM sifatida (drei Html transform) beriladi — matn har
 * qanday o'lchamda keskin, i18n ishlaydi. Hover'da qurilma yumshoq ko'tariladi
 * (micro-interaction), ekran chetida 1px cyan/emerald edge accent.
 */

const BODY = "#101318";
const BODY_DARK = "#0a0c10";

/** Hover'da yumshoq lift — barcha qurilmalar uchun umumiy group */
function HoverGroup({
  children,
  position,
  rotation,
  lift = 0.12,
}: {
  children: ReactNode;
  position: [number, number, number];
  rotation?: [number, number, number];
  lift?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const baseY = position[1];

  useFrame((_, delta) => {
    if (!group.current) return;
    const targetY = baseY + (hovered ? lift : 0);
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, targetY, 6, delta);
  });

  return (
    <group
      ref={group}
      position={position}
      rotation={rotation}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      {children}
    </group>
  );
}

/** Ekran paneli: qora emissive yuza + DOM kontent + 1px edge accent */
function ScreenPanel({
  width,
  height,
  screen,
  pxWidth,
  pxHeight,
  accent = "#38ddff",
}: {
  width: number;
  height: number;
  screen: ReactNode;
  pxWidth: number;
  pxHeight: number;
  accent?: string;
}) {
  // 1px ≈ width/pxWidth unit — Html transform scale shu nisbatdan
  const scale = width / pxWidth;
  return (
    <group>
      {/* Yorug'lik beruvchi ekran yuzasi */}
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#05070c" />
      </mesh>
      {/* Edge accent — 1px cyan/emerald chiziq */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(width, height)]} />
        <lineBasicMaterial color={accent} transparent opacity={0.55} />
      </lineSegments>
      <Html
        transform
        scale={scale}
        position={[0, 0, 0.002]}
        style={{ width: pxWidth, height: pxHeight, overflow: "hidden", borderRadius: 8 }}
        zIndexRange={[10, 0]}
      >
        {screen}
      </Html>
    </group>
  );
}

/** MacBook — markazda, ochiq holatda */
export function MacBookMock({
  position = [0, 0, 0] as [number, number, number],
  screen,
}: {
  position?: [number, number, number];
  screen: ReactNode;
}) {
  const W = 3.6;
  const D = 2.35;
  const screenH = 2.3;
  const tilt = -0.21; // ekran orqaga ~12°
  return (
    <HoverGroup position={position}>
      {/* Baza (klaviatura qismi) */}
      <RoundedBox args={[W, 0.11, D]} radius={0.045} position={[0, 0.055, 0]}>
        <meshStandardMaterial color={BODY} metalness={0.75} roughness={0.32} />
      </RoundedBox>
      {/* Klaviatura chuqurchasi */}
      <mesh position={[0, 0.113, 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W * 0.86, D * 0.55]} />
        <meshStandardMaterial color={BODY_DARK} metalness={0.5} roughness={0.6} />
      </mesh>
      {/* Ekran qopqog'i */}
      <group position={[0, 0.11, -D / 2 + 0.02]} rotation={[tilt, 0, 0]}>
        <RoundedBox args={[W, screenH, 0.07]} radius={0.035} position={[0, screenH / 2, 0]}>
          <meshStandardMaterial color={BODY} metalness={0.75} roughness={0.32} />
        </RoundedBox>
        <group position={[0, screenH / 2, 0.039]}>
          <ScreenPanel width={W - 0.22} height={screenH - 0.2} screen={screen} pxWidth={480} pxHeight={290} accent="#38ddff" />
        </group>
      </group>
      {/* Ostidagi glow — polga aks */}
      <mesh position={[0, 0.005, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.4, 32]} />
        <meshBasicMaterial color="#1ba9c9" transparent opacity={0.05} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </HoverGroup>
  );
}

/** iPhone — chapda, tik turgan */
export function PhoneMock({
  position = [-3, 0, 1] as [number, number, number],
  rotation = [0, 0.45, 0] as [number, number, number],
  screen,
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
  screen: ReactNode;
}) {
  const W = 1.0;
  const H = 2.05;
  return (
    <HoverGroup position={position} rotation={rotation}>
      <RoundedBox args={[W, H, 0.09]} radius={0.09} position={[0, H / 2, 0]}>
        <meshStandardMaterial color={BODY} metalness={0.7} roughness={0.35} />
      </RoundedBox>
      <group position={[0, H / 2, 0.048]}>
        <ScreenPanel width={W - 0.1} height={H - 0.14} screen={screen} pxWidth={170} pxHeight={362} accent="#38ddff" />
      </group>
      <mesh position={[0, 0.004, 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.9, 24]} />
        <meshBasicMaterial color="#1ba9c9" transparent opacity={0.05} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </HoverGroup>
  );
}

/** iPad — o'ngda, stendda biroz yotiq */
export function TabletMock({
  position = [3.1, 0, 0.6] as [number, number, number],
  rotation = [0, -0.5, 0] as [number, number, number],
  screen,
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
  screen: ReactNode;
}) {
  const W = 2.55;
  const H = 1.9;
  return (
    <HoverGroup position={position} rotation={rotation}>
      {/* Stend */}
      <mesh position={[0, 0.5, -0.22]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.7, 1.0, 0.03]} />
        <meshStandardMaterial color={BODY_DARK} metalness={0.7} roughness={0.4} />
      </mesh>
      <group rotation={[-0.12, 0, 0]}>
        <RoundedBox args={[W, H, 0.08]} radius={0.07} position={[0, H / 2 + 0.06, 0]}>
          <meshStandardMaterial color={BODY} metalness={0.7} roughness={0.35} />
        </RoundedBox>
        <group position={[0, H / 2 + 0.06, 0.043]}>
          <ScreenPanel width={W - 0.14} height={H - 0.14} screen={screen} pxWidth={340} pxHeight={248} accent="#3ddba4" />
        </group>
      </group>
      <mesh position={[0, 0.004, 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.5, 24]} />
        <meshBasicMaterial color="#22b083" transparent opacity={0.05} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </HoverGroup>
  );
}
