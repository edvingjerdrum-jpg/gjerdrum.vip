import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BOXES, BOT_COUNT, EYE, MAP_SIZE, WEAPONS, createGame, step, type Game as G, type WeaponId } from "./sim";

const MAX_SHOTS = 120;

function makeTex(draw: (c: CanvasRenderingContext2D) => void, repeat: number) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Fish({ color, size = 1 }: { color: string; size?: number }) {
  return (
    <group scale={size}>
      <mesh scale={[0.18, 0.28, 0.6]}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.7]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.3]}>
        <coneGeometry args={[0.25, 0.35, 4]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0.12, 0.08, -0.4]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[-0.12, 0.08, -0.4]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  );
}

function Level() {
  const [sand, wall, crate] = useMemo(
    () => [
      makeTex((c) => {
        c.fillStyle = "#c9a86a"; c.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 600; i++) { c.fillStyle = `rgba(${90 + Math.random() * 60},70,30,0.15)`; c.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
      }, 20),
      makeTex((c) => {
        c.fillStyle = "#d8c08a"; c.fillRect(0, 0, 128, 128); c.strokeStyle = "#a88a55"; c.lineWidth = 2;
        for (let y = 0; y < 128; y += 32) { c.strokeRect(0, y, 128, 32); c.beginPath(); c.moveTo(64, y); c.lineTo(64, y + 32); c.stroke(); }
      }, 1),
      makeTex((c) => {
        c.fillStyle = "#8a5a2b"; c.fillRect(0, 0, 128, 128); c.strokeStyle = "#5b3a18"; c.lineWidth = 8;
        c.strokeRect(4, 4, 120, 120); c.beginPath(); c.moveTo(0, 0); c.lineTo(128, 128); c.stroke();
      }, 1),
    ],
    [],
  );
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[MAP_SIZE, MAP_SIZE]} />
        <meshStandardMaterial map={sand} />
      </mesh>
      {BOXES.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]} castShadow receiveShadow>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial map={b.kind === "crate" ? crate : wall} />
        </mesh>
      ))}
    </>
  );
}

function Bots({ game }: { game: G }) {
  const face = useLoader(THREE.TextureLoader, "/images/face.jpg");
  face.colorSpace = THREE.SRGBColorSpace;
  const refs = useRef<(THREE.Group | null)[]>([]);
  const bodyMats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  useFrame(() => {
    game.bots.forEach((b, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.visible = b.dead <= 0;
      g.position.set(b.pos.x, 0, b.pos.z);
      g.rotation.y = b.yaw;
      g.position.y = Math.abs(Math.sin(game.time * 8 + i)) * 0.1;
      bodyMats.current[i]?.emissive.setRGB(b.hit > 0 ? 0.8 : 0, 0, 0);
    });
  });
  return (
    <>
      {Array.from({ length: BOT_COUNT }, (_, i) => (
        <group key={i} ref={(r) => { refs.current[i] = r; }}>
          <mesh position={[0, 0.95, 0]} castShadow>
            <boxGeometry args={[0.8, 1.1, 0.45]} />
            <meshStandardMaterial ref={(m) => { bodyMats.current[i] = m; }} color="#1c2a4a" />
          </mesh>
          <mesh position={[-0.2, 0.25, 0]}><boxGeometry args={[0.28, 0.5, 0.3]} /><meshStandardMaterial color="#222" /></mesh>
          <mesh position={[0.2, 0.25, 0]}><boxGeometry args={[0.28, 0.5, 0.3]} /><meshStandardMaterial color="#222" /></mesh>
          <mesh position={[0, 1.85, 0]} castShadow>
            <boxGeometry args={[0.6, 0.7, 0.55]} />
            <meshStandardMaterial attach="material-0" color="#c9a26a" />
            <meshStandardMaterial attach="material-1" color="#c9a26a" />
            <meshStandardMaterial attach="material-2" color="#c9a26a" />
            <meshStandardMaterial attach="material-3" color="#e8b89a" />
            <meshStandardMaterial attach="material-4" color="#c9a26a" />
            <meshStandardMaterial attach="material-5" map={face} />
          </mesh>
          <group position={[0.45, 1.1, -0.4]} rotation={[0, 0, Math.PI / 2]}>
            <Fish color={WEAPONS[(["sill", "makrill", "kugelfisk"] as WeaponId[])[i % 3]!].color} size={0.7} />
          </group>
        </group>
      ))}
    </>
  );
}

function Shots({ game }: { game: G }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    for (let i = 0; i < MAX_SHOTS; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const s = game.shots[i];
      g.visible = !!s;
      if (!s) continue;
      g.position.set(s.pos.x, s.pos.y, s.pos.z);
      tmp.set(s.pos.x - s.vel.x, s.pos.y - s.vel.y, s.pos.z - s.vel.z);
      g.lookAt(tmp);
      g.rotateZ(s.spin);
      const w = WEAPONS[s.kind];
      g.scale.setScalar(w.size);
      mats.current[i]?.color.set(w.color);
    }
  });
  return (
    <>
      {Array.from({ length: MAX_SHOTS }, (_, i) => (
        <group key={i} ref={(r) => { refs.current[i] = r; }} visible={false}>
          <mesh scale={[0.18, 0.28, 0.6]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial ref={(m) => { mats.current[i] = m; }} metalness={0.5} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, 0.7]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.3]}>
            <coneGeometry args={[0.25, 0.35, 4]} />
            <meshStandardMaterial color="#666" />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Player({ game, weapon }: { game: G; weapon: WeaponId }) {
  const { camera, gl } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const fire = useRef(false);
  const held = useRef<THREE.Group>(null);
  const recoil = useRef(0);

  useEffect(() => {
    const el = gl.domElement;
    const kd = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const ku = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    const mm = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      const p = game.player;
      p.yaw -= e.movementX * 0.0022;
      p.pitch = Math.max(-1.4, Math.min(1.4, p.pitch - e.movementY * 0.0022));
    };
    const md = () => { if (document.pointerLockElement !== el) el.requestPointerLock(); else fire.current = true; };
    const mu = () => { fire.current = false; };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    window.addEventListener("mousemove", mm); el.addEventListener("mousedown", md); window.addEventListener("mouseup", mu);
    return () => {
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
      window.removeEventListener("mousemove", mm); el.removeEventListener("mousedown", md); window.removeEventListener("mouseup", mu);
    };
  }, [gl, game]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const k = keys.current;
    const before = game.player.cd;
    step(game, dt, {
      fwd: (k["KeyW"] || k["ArrowUp"] ? 1 : 0) - (k["KeyS"] || k["ArrowDown"] ? 1 : 0),
      right: (k["KeyD"] || k["ArrowRight"] ? 1 : 0) - (k["KeyA"] || k["ArrowLeft"] ? 1 : 0),
      fire: fire.current,
    });
    if (game.player.cd > before) recoil.current = 1;
    recoil.current *= Math.exp(-12 * dt);
    const p = game.player;
    camera.position.set(p.pos.x, p.dead > 0 ? 0.4 : EYE, p.pos.z);
    camera.rotation.set(p.pitch, p.yaw, p.dead > 0 ? 0.6 : 0, "YXZ");
    if (held.current) {
      held.current.position.set(0.35, -0.3 + Math.sin(game.time * 6) * 0.01, -0.7 + recoil.current * 0.15);
      held.current.rotation.x = recoil.current * 0.3;
    }
  });

  return (
    <primitive object={camera}>
      <group ref={held}>
        <Fish color={WEAPONS[weapon].color} size={WEAPONS[weapon].size * 0.7} />
      </group>
    </primitive>
  );
}

function Ready() {
  const done = useRef(false);
  const { gl } = useThree();
  useFrame(() => {
    if (!done.current) { done.current = true; gl.domElement.parentElement?.setAttribute("data-scene-ready", "true"); }
  });
  return null;
}

export default function FishGame() {
  const game = useMemo(() => createGame(), []);
  const [weapon, setWeapon] = useState<WeaponId>(game.player.weapon);
  const [hud, setHud] = useState({ hp: 100, kills: 0, deaths: 0, feed: [] as string[], dead: 0 });
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __game: G }).__game = game;
    const id = setInterval(() => {
      const p = game.player;
      setHud({ hp: p.hp, kills: game.kills, deaths: game.deaths, feed: [...game.feed], dead: p.dead });
    }, 100);
    const kd = (e: KeyboardEvent) => {
      const w = (Object.keys(WEAPONS) as WeaponId[]).find((id) => WEAPONS[id].key === e.key);
      if (w) { game.player.weapon = w; setWeapon(w); }
    };
    const lc = () => setLocked(!!document.pointerLockElement);
    window.addEventListener("keydown", kd);
    document.addEventListener("pointerlockchange", lc);
    return () => { clearInterval(id); window.removeEventListener("keydown", kd); document.removeEventListener("pointerlockchange", lc); };
  }, [game]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background select-none">
      <Canvas shadows camera={{ fov: 75, near: 0.05, far: 200 }}>
        <color attach="background" args={["#9cc7e6"]} />
        <fog attach="fog" args={["#d8c9a8", 30, 90]} />
        <hemisphereLight args={["#fff4dd", "#a07a48", 0.7]} />
        <directionalLight position={[20, 30, 10]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-35} shadow-camera-right={35} shadow-camera-top={35} shadow-camera-bottom={-35} />
        <Environment>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={1} color="#ffd9a0" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
        </Environment>
        <Level />
        <Bots game={game} />
        <Shots game={game} />
        <Player game={game} weapon={weapon} />
        <Ready />
      </Canvas>

      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl font-bold text-hud">+</div>

      <div className="pointer-events-none absolute right-4 top-4 space-y-1 text-right font-mono text-sm">
        {hud.feed.map((f, i) => <div key={i} className="rounded bg-hud-panel px-2 py-1 text-hud">{f}</div>)}
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 rounded bg-hud-panel px-4 py-2 font-mono text-3xl font-bold text-hud">
        ✚ {hud.hp}
      </div>
      <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded bg-hud-panel px-4 py-1 font-mono text-lg text-hud">
        Kills {hud.kills} · Död {hud.deaths}
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 space-y-1 rounded bg-hud-panel p-3 font-mono text-sm text-hud">
        {(Object.keys(WEAPONS) as WeaponId[]).map((id) => (
          <div key={id} className={id === weapon ? "font-bold text-hud-accent" : "opacity-60"}>
            [{WEAPONS[id].key}] {WEAPONS[id].name}
          </div>
        ))}
      </div>

      {hud.dead > 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-hud-danger">
          <div className="font-mono text-5xl font-bold text-hud">Du blev fiskad! 🐟</div>
        </div>
      )}

      {!locked && hud.dead <= 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-hud-panel text-center text-hud">
          <h1 className="font-mono text-5xl font-bold">FISK STRIKE</h1>
          <p className="mt-4 font-mono">Klicka för att spela</p>
          <p className="mt-2 font-mono text-sm opacity-80">WASD = gå · Mus = sikta · Klick = skjut fisk · 1-4 = byt fisk · Esc = paus</p>
        </div>
      )}
    </div>
  );
}
