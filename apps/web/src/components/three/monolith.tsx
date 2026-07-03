"use client";
import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Monolith — mahsulotning yagona 3D lahzasi.
 * "Data-viz orb" emas, sahnaga qo'yilgan DIZAYN OBYEKTI (Apple keynote uslubi):
 *   - bitta uzluksiz matte yuza (nuqta/chiziq/zarracha yo'q)
 *   - deyarli sezilmas aylanish (tinchlik = ishonch); harakat faqat interaksiyada
 *   - urg'u rangi FAQAT ingichka fresnel rim-light sifatida, nur/wash emas
 *   - studio key + fill yorug'lik ishni bajaradi
 * Butun mahsulotdagi yagona "qimmat" 3D moment.
 */

const ACCENT = new THREE.Color("hsl(198, 66%, 60%)");

// Fresnel rim — yuzaning chetida ingichka arctic yorug'lik
const RIM_VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vView;
  void main() {
    vec4 wp = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = normalize(-wp.xyz);
    gl_Position = projectionMatrix * wp;
  }
`;
const RIM_FRAG = /* glsl */ `
  uniform vec3 uColor; varying vec3 vN; varying vec3 vView;
  void main() {
    float f = 1.0 - max(dot(normalize(vN), normalize(vView)), 0.0);
    f = pow(f, 3.2);                 // faqat chekka
    gl_FragColor = vec4(uColor * f, f * 0.9);
  }
`;

function Sculpture() {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const vel = useRef(0.03); // asosiy — deyarli sezilmas

  useFrame((_, dt) => {
    if (!group.current) return;
    // Interaksiyada "og'irlik bilan" javob: hover tezlikni oshiradi, so'ng tiniydi
    const target = hovered ? 0.32 : 0.03;
    vel.current += (target - vel.current) * Math.min(1, dt * 2.2);
    group.current.rotation.y += vel.current * dt;
    group.current.rotation.x = Math.sin(group.current.rotation.y * 0.5) * 0.06;
  });

  return (
    <group
      ref={group}
      onPointerOver={() => { setHovered(true); document.body.style.cursor = "grab"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
    >
      {/* Asosiy matte yuza — sovuq grafit; shakl yorug'lik gradienti bilan ochiladi */}
      <mesh>
        <icosahedronGeometry args={[1.15, 8]} />
        <meshStandardMaterial color="#3c434f" roughness={0.55} metalness={0.0} />
      </mesh>
      {/* Fresnel rim — arctic chekka yorug'lik (nur emas, chiziq) */}
      <mesh scale={1.002}>
        <icosahedronGeometry args={[1.15, 6]} />
        <shaderMaterial
          vertexShader={RIM_VERT}
          fragmentShader={RIM_FRAG}
          uniforms={{ uColor: { value: ACCENT } }}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export default function Monolith({ className }: { className?: string }) {
  return (
    <Canvas
      className={className}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: true }}
      camera={{ position: [0, 0, 4.2], fov: 40 }}
      style={{ background: "transparent" }}
    >
      {/* 3-nuqtali studio yorug'lik — shakl qorong'ilikdan yorug' tomonga ochiladi */}
      <ambientLight intensity={0.12} />
      {/* Key — yuqori-o'ng, yumshoq oq */}
      <directionalLight position={[4, 5, 3]} intensity={2.6} color="#f2f5f8" />
      {/* Fill — past chap, kuchsiz sovuq */}
      <directionalLight position={[-5, -2, 2]} intensity={0.5} color="#7c8798" />
      {/* Rim — orqadan, arctic (chekka yorug'ligini kuchaytiradi) */}
      <directionalLight position={[-2, 1, -5]} intensity={1.2} color="#43b6d6" />
      <Sculpture />
    </Canvas>
  );
}
