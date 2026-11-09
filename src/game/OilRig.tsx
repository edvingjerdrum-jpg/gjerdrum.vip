import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BOXES, MAP_SIZE } from "./sim";

/** Convert themed CSS colors into sRGB for three.js materials and canvas textures. */
export function useRigPalette() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    const styles = getComputedStyle(document.documentElement);
    const color = (name: string) => {
      context.fillStyle = styles.getPropertyValue(`--rig-${name}`).trim();
      context.fillRect(0, 0, 1, 1);
      const data = context.getImageData(0, 0, 1, 1).data;
      return `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
    };
    return { steel: color("steel"), deck: color("deck"), dark: color("dark"), yellow: color("yellow"), red: color("red"), pale: color("pale"), ocean: color("ocean"), sky: color("sky"), light: color("light"), foam: color("foam") };
  }, []);
}

type Palette = ReturnType<typeof useRigPalette>;
type Point = [number, number, number];

function Beam({ a, b, radius = 0.12, color }: { a: Point; b: Point; radius?: number; color: string }) {
  const { position, rotation, length } = useMemo(() => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    return { position: start.add(end).multiplyScalar(0.5), rotation: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()), length: direction.length() };
  }, [a, b]);
  return <mesh position={position} quaternion={rotation} castShadow><cylinderGeometry args={[radius, radius, length, 8]} /><meshStandardMaterial color={color} metalness={0.65} roughness={0.45} /></mesh>;
}

function Tower({ palette: p }: { palette: Palette }) {
  const corners: [number, number][] = [[-5, -0.55], [5, -0.55], [5, 0.55], [-5, 0.55]];
  return <group position={[0, 5, 18]}>
    {corners.map(([x, z], i) => <Beam key={i} a={[x, 0, z]} b={[x * 0.23, 25, z * 0.23]} radius={0.24} color={p.red} />)}
    {[0, 5, 10, 15, 20].map((y) => {
      const w = 5 * (1 - y / 32), next = 5 * (1 - (y + 5) / 32);
      return <group key={y}>
        <Beam a={[-w, y, -0.55]} b={[w, y, -0.55]} color={p.pale} />
        <Beam a={[-w, y, -0.55]} b={[next, y + 5, -0.45]} color={p.red} />
        <Beam a={[w, y, -0.55]} b={[-next, y + 5, -0.45]} color={p.red} />
      </group>;
    })}
    <Beam a={[0, 0, 0]} b={[0, 26, 0]} radius={0.3} color={p.dark} />
    <mesh position={[0, 25.5, 0]}><boxGeometry args={[3, 1, 2]} /><meshStandardMaterial color={p.yellow} /></mesh>
  </group>;
}

function Ocean({ palette: p }: { palette: Palette }) {
  const water = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (water.current) water.current.position.y = -8 + Math.sin(clock.elapsedTime * 0.45) * 0.15; });
  return <group>
    <mesh ref={water} rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]}><planeGeometry args={[1600, 1600]} /><meshStandardMaterial color={p.ocean} metalness={0.35} roughness={0.3} /></mesh>
    {[-62, -44, 44, 62, 88].map((z) => <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, -7.75, z]}><planeGeometry args={[180, 0.12]} /><meshStandardMaterial color={p.foam} transparent opacity={0.4} /></mesh>)}
  </group>;
}

export default function OilRig() {
  const p = useRigPalette();
  const deckTexture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("Canvas unavailable");
    c.fillStyle = p.deck; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = p.steel; c.lineWidth = 2;
    for (let i = 0; i <= 128; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 128); c.moveTo(0, i); c.lineTo(128, i); c.stroke(); }
    c.fillStyle = p.pale;
    for (const x of [5, 123]) for (const y of [5, 123]) c.fillRect(x, y, 2, 2);
    const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(24, 24); texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [p]);
  return <>
    <Ocean palette={p} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[MAP_SIZE, MAP_SIZE]} /><meshStandardMaterial map={deckTexture} metalness={0.55} roughness={0.7} /></mesh>
    <mesh position={[0, -0.9, 0]}><boxGeometry args={[MAP_SIZE + 1, 1.8, MAP_SIZE + 1]} /><meshStandardMaterial color={p.red} metalness={0.5} /></mesh>
    {[-24, 24].flatMap((x) => [-24, 24].map((z) => <mesh key={`${x}:${z}`} position={[x, -7, z]}><cylinderGeometry args={[2, 2.5, 14, 12]} /><meshStandardMaterial color={p.yellow} metalness={0.6} /></mesh>))}
    {BOXES.map((b, i) => {
      const edge = Math.abs(b.x) === MAP_SIZE / 2 || Math.abs(b.z) === MAP_SIZE / 2;
      if (edge) {
        const alongX = b.w > b.d;
        return <group key={i} position={[b.x, 0, b.z]}>
          <mesh position={[0, 0.2, 0]}><boxGeometry args={[b.w, 0.4, b.d]} /><meshStandardMaterial color={p.yellow} /></mesh>
          {[1.2, 3.5, 6].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[b.w, 0.1, b.d * 0.1]} /><meshStandardMaterial color={p.yellow} /></mesh>)}
          {Array.from({ length: 21 }, (_, k) => <mesh key={k} position={[alongX ? -30 + k * 3 : 0, 3, alongX ? 0 : -30 + k * 3]}><boxGeometry args={[0.12, 6, 0.12]} /><meshStandardMaterial color={p.steel} /></mesh>)}
        </group>;
      }
      return <group key={i} position={[b.x, 0, b.z]}>
        <mesh position={[0, b.h / 2, 0]} castShadow receiveShadow><boxGeometry args={[b.w, b.h, b.d]} /><meshStandardMaterial color={b.kind === "crate" ? (i % 2 ? p.red : p.yellow) : p.pale} metalness={0.5} roughness={0.6} /></mesh>
        <mesh position={[0, b.h - 0.18, 0]}><boxGeometry args={[b.w + 0.05, 0.22, b.d + 0.05]} /><meshStandardMaterial color={p.dark} /></mesh>
        {Array.from({ length: b.kind === "crate" ? 4 : 9 }, (_, k) => <mesh key={k} position={[-b.w / 2 + (k + 0.5) * b.w / (b.kind === "crate" ? 4 : 9), b.h / 2, b.d / 2 + 0.015]}><boxGeometry args={[0.06, b.h - 0.4, 0.04]} /><meshStandardMaterial color={p.steel} /></mesh>)}
        {b.kind === "wall" && <Beam a={[-b.w / 2, b.h + 0.35, 0]} b={[b.w / 2, b.h + 0.35, 0]} radius={0.22} color={p.yellow} />}
      </group>;
    })}
    <Tower palette={p} />
    <group position={[34, 0, -12]}>
      <Beam a={[0, -8, 0]} b={[0, 18, 0]} radius={1} color={p.yellow} />
      <Beam a={[0, 18, 0]} b={[-20, 22, 0]} radius={0.35} color={p.yellow} />
      <Beam a={[0, 14, 0]} b={[-20, 22, 0]} radius={0.2} color={p.yellow} />
      <Beam a={[-20, 22, 0]} b={[-20, 8, 0]} radius={0.035} color={p.dark} />
      <mesh position={[-20, 7.5, 0]}><torusGeometry args={[0.4, 0.12, 8, 12, Math.PI * 1.5]} /><meshStandardMaterial color={p.dark} /></mesh>
      <mesh position={[0, 15, 0]}><boxGeometry args={[3, 3, 3]} /><meshStandardMaterial color={p.red} /></mesh>
    </group>
    <group position={[-20, 0.035, 20]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh><circleGeometry args={[6, 48]} /><meshStandardMaterial color={p.dark} /></mesh>
      <mesh position={[0, 0, 0.01]}><ringGeometry args={[5.6, 5.85, 48]} /><meshStandardMaterial color={p.yellow} /></mesh>
      {[-1.2, 1.2].map((x) => <mesh key={x} position={[x, 0, 0.02]}><planeGeometry args={[0.45, 3.5]} /><meshStandardMaterial color={p.pale} /></mesh>)}
      <mesh position={[0, 0, 0.02]}><planeGeometry args={[2.4, 0.45]} /><meshStandardMaterial color={p.pale} /></mesh>
    </group>
    {[-27, 27].map((x) => <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.025, 0]}><planeGeometry args={[0.18, 55]} /><meshStandardMaterial color={p.yellow} /></mesh>)}
  </>;
}