import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  BOT_COUNT, EYE, WEAPONS, WEAPON_IDS, addRemoteShot, createGame, damagePlayer, pushFeed, scoreboard, step,
  type Game as G, type WeaponId,
} from "./sim";
import { playOuches } from "./ouch";
import { MAX_ROOM, netTick, playerId, useGameChannel } from "./net";
import OilRig, { useRigPalette } from "./OilRig";
import { sprintHeld } from "./controls";
import { createCommentary, playCommentary } from "./commentator";
import { stopGameVoice } from "./voice";

const MAX_SHOTS = 160;
const BOT_WEAPONS: WeaponId[] = ["sill", "makrill", "kugelfisk"];

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
      <mesh position={[0.12, 0.08, -0.4]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[-0.12, 0.08, -0.4]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#111" /></mesh>
    </group>
  );
}

type AvatarRefs = { group: THREE.Group | null; body: THREE.MeshStandardMaterial | null };

function Avatar({ face, weapon, refs }: { face: THREE.Texture; weapon: WeaponId; refs: AvatarRefs }) {
  return (
    <group ref={(r) => { refs.group = r; }}>
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[0.8, 1.1, 0.45]} />
        <meshStandardMaterial ref={(m) => { refs.body = m; }} color="#1c2a4a" />
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
        <Fish color={WEAPONS[weapon].color} size={0.7} />
      </group>
    </group>
  );
}

function useFace() {
  const face = useLoader(THREE.TextureLoader, "/images/face.jpg");
  face.colorSpace = THREE.SRGBColorSpace;
  return face;
}

function Bots({ game }: { game: G }) {
  const face = useFace();
  const refs = useMemo(() => Array.from({ length: BOT_COUNT }, (): AvatarRefs => ({ group: null, body: null })), []);
  useFrame(() => {
    game.bots.forEach((b, i) => {
      const r = refs[i]!;
      if (!r.group) return;
      r.group.visible = b.dead <= 0;
      r.group.position.set(b.pos.x, Math.abs(Math.sin(game.time * 8 + i)) * 0.1, b.pos.z);
      r.group.rotation.y = b.yaw;
      r.body?.emissive.setRGB(b.hit > 0 ? 0.8 : 0, 0, 0);
    });
  });
  if (game.mode !== "solo") return null;
  return <>{refs.map((r, i) => <Avatar key={i} face={face} weapon={BOT_WEAPONS[i % 3]!} refs={r} />)}</>;
}

/** Owns the room channel, the send loop and remote avatars. Mounted once, online only. */
function Network({ game, room, onRoster }: { game: G; room: string; onRoster: (n: number) => void }) {
  const face = useFace();
  const [ids, setIds] = useState<string[]>([]);
  const [weapons, setWeapons] = useState<Record<string, WeaponId>>({});
  const refs = useRef(new Map<string, AvatarRefs>());
  const acc = useRef(0);
  const last = useRef({ key: "", at: -10 });
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const nameOf = (id: string) => (id === playerId ? "Du" : game.remotes.get(id)?.name ?? "Noen");

  const channel = useGameChannel(room, game.name, {
    onRoster: (list) => {
      const others = list.filter((p) => p.id !== playerId).slice(0, MAX_ROOM - 1);
      const keep = new Set(others.map((p) => p.id));
      for (const id of [...game.remotes.keys()]) if (!keep.has(id)) game.remotes.delete(id);
      for (const p of others) {
        const r = game.remotes.get(p.id);
        if (r) r.name = p.name;
        else game.remotes.set(p.id, { id: p.id, name: p.name, pos: { x: 0, y: 0, z: 0 }, yaw: 0, weapon: "sill", dead: false, kills: 0, deaths: 0, hit: 0, seen: false });
      }
      setIds(others.map((p) => p.id));
      onRoster(others.length + 1);
    },
    onState: (s) => {
      const r = game.remotes.get(s.id);
      if (!r) return;
      r.pos.x = s.x; r.pos.y = s.y ?? 0; r.pos.z = s.z; r.yaw = s.ry; r.dead = s.dead; r.kills = s.k; r.deaths = s.d; r.seen = true;
      if (r.weapon !== s.w) { r.weapon = s.w; setWeapons((w) => ({ ...w, [s.id]: s.w })); }
    },
    onShot: (s) => { if (game.remotes.has(s.id)) addRemoteShot(game, { type: "shot", ...s }); },
    onHit: (h) => {
      if (h.target !== playerId || !game.remotes.has(h.from)) return;
      if (damagePlayer(game, h.dmg)) {
        game.killedBy = h.from;
        pushFeed(game, `${nameOf(h.from)} 🐟 deg (${WEAPONS[h.kind].name})`);
        channel.current?.send({ type: "broadcast", event: "kill", payload: { killer: h.from, victim: playerId, kind: h.kind } });
      }
    },
    onKill: (k) => {
      if (k.killer === playerId) game.kills++;
      pushFeed(game, `${nameOf(k.killer)} 🐟 ${nameOf(k.victim)} (${WEAPONS[k.kind].name})`);
    },
  });

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const t = 1 - Math.exp(-12 * dt);
    for (const [id, r] of game.remotes) {
      const a = refs.current.get(id);
      if (!a?.group) continue;
      a.group.visible = r.seen && !r.dead;
      tmp.set(r.pos.x, r.pos.y, r.pos.z);
      if (a.group.position.distanceTo(tmp) > 5) a.group.position.copy(tmp);
      else a.group.position.lerp(tmp, t);
      const dy = r.yaw - a.group.rotation.y;
      a.group.rotation.y += Math.atan2(Math.sin(dy), Math.cos(dy)) * t;
      a.body?.emissive.setRGB(r.hit > 0 ? 0.8 : 0, 0, 0);
    }

    const ch = channel.current;
    // discrete events go out immediately
    if (ch) {
      for (const e of game.outbox) {
        if (e.type === "shot") ch.send({ type: "broadcast", event: "shot", payload: { id: playerId, x: e.x, y: e.y, z: e.z, dx: e.dx, dy: e.dy, dz: e.dz, kind: e.kind } });
        else ch.send({ type: "broadcast", event: "hit", payload: { from: playerId, target: e.target, dmg: e.dmg, kind: e.kind } });
      }
    }
    game.outbox.length = 0;
  });

  // State sync runs on a timer, independent of frame rate.
  useEffect(() => {
    const id = setInterval(() => {
      const ch = channel.current;
      const now = performance.now() / 1000;
      if (!ch || document.hidden || now - acc.current < netTick(game.remotes.size + 1) - 0.01) return;
      acc.current = now;
      sendState(ch, now);
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  function sendState(ch: NonNullable<typeof channel.current>, now: number) {
    const p = game.player;
    const s = {
      id: playerId, name: game.name,
      x: Math.round(p.pos.x * 100) / 100, y: Math.round(p.pos.y * 100) / 100, z: Math.round(p.pos.z * 100) / 100, ry: Math.round(p.yaw * 100) / 100,
      w: p.weapon, dead: p.dead > 0, k: game.kills, d: game.deaths,
    };
    const key = JSON.stringify(s);
    if (key === last.current.key && now - last.current.at < 1) return;
    last.current = { key, at: now };
    ch.send({ type: "broadcast", event: "state", payload: s });
  }

  return (
    <>
      {ids.map((id) => {
        let r = refs.current.get(id);
        if (!r) { r = { group: null, body: null }; refs.current.set(id, r); }
        return <Avatar key={id} face={face} weapon={weapons[id] ?? "sill"} refs={r} />;
      })}
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

function Player({ game, weapon, paused }: { game: G; weapon: WeaponId; paused: React.RefObject<boolean> }) {
  const { camera, gl } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const fire = useRef(false);
  const held = useRef<THREE.Group>(null);
  const recoil = useRef(0);
  const commentary = useMemo(createCommentary, [game]);

  useEffect(() => stopGameVoice, []);

  useEffect(() => {
    const el = gl.domElement;
    const kd = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === "Space") e.preventDefault();
    };
    const ku = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    const mm = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      const p = game.player;
      p.yaw -= e.movementX * 0.0022;
      p.pitch = Math.max(-1.4, Math.min(1.4, p.pitch - e.movementY * 0.0022));
    };
    const md = () => { if (document.pointerLockElement === el) fire.current = true; };
    const mu = () => { fire.current = false; };
    const blur = () => { keys.current = {}; fire.current = false; };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); window.addEventListener("blur", blur);
    window.addEventListener("mousemove", mm); el.addEventListener("mousedown", md); window.addEventListener("mouseup", mu);
    return () => {
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("blur", blur);
      window.removeEventListener("mousemove", mm); el.removeEventListener("mousedown", md); window.removeEventListener("mouseup", mu);
    };
  }, [gl, game]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const k = keys.current;
    const isPaused = paused.current;
    // Solo freezes on pause; online keeps running (you just stand still).
    if (!isPaused || game.mode === "online") {
      const before = game.player.cd;
      step(game, dt, {
        fwd: isPaused ? 0 : (k["KeyW"] || k["ArrowUp"] ? 1 : 0) - (k["KeyS"] || k["ArrowDown"] ? 1 : 0),
        right: isPaused ? 0 : (k["KeyD"] || k["ArrowRight"] ? 1 : 0) - (k["KeyA"] || k["ArrowLeft"] ? 1 : 0),
        fire: !isPaused && fire.current,
        jump: !isPaused && !!k["Space"],
        sprint: !isPaused && sprintHeld(k),
      });
      if (game.player.cd > before) recoil.current = 1;
    }
    const now = performance.now() / 1000;
    if (!isPaused) playCommentary(commentary, game, now);
    playOuches(game, now);
    recoil.current *= Math.exp(-12 * dt);
    const p = game.player;
    camera.position.set(p.pos.x, p.pos.y + (p.dead > 0 ? 0.4 : EYE), p.pos.z);
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

function RigEnvironment() {
  const p = useRigPalette();
  return <>
    <color attach="background" args={[p.sky]} />
    <fog attach="fog" args={[p.sky, 90, 500]} />
    <hemisphereLight args={[p.light, p.ocean, 1.3]} />
    <directionalLight position={[20, 35, -10]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-35} shadow-camera-right={35} shadow-camera-top={35} shadow-camera-bottom={-35} />
    <Environment><Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} /><Lightformer intensity={1} color={p.light} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} /></Environment>
  </>;
}

export type GameProps = { mode: "solo" | "online"; name: string; room: string | null; onExit: () => void };

export default function FishGame({ mode, name, room, onExit }: GameProps) {
  const game = useMemo(() => createGame(mode, name), [mode, name]);
  const [weapon, setWeapon] = useState<WeaponId>(game.player.weapon);
  const [hud, setHud] = useState({ hp: 100, kills: 0, deaths: 0, feed: [] as string[], dead: 0 });
  const [locked, setLocked] = useState(false);
  const [started, setStarted] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [players, setPlayers] = useState(1);
  const [copied, setCopied] = useState(false);
  const paused = useRef(true);
  const wrap = useRef<HTMLDivElement>(null);

  const lock = () => { wrap.current?.querySelector("canvas")?.requestPointerLock(); };

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __game: G }).__game = game;
    const id = setInterval(() => {
      const p = game.player;
      setHud({ hp: p.hp, kills: game.kills, deaths: game.deaths, feed: [...game.feed], dead: p.dead });
    }, 100);
    const kd = (e: KeyboardEvent) => {
      if (e.key === "Tab") { e.preventDefault(); setShowScores(true); return; }
      const w = WEAPON_IDS.find((id) => WEAPONS[id].key === e.key);
      if (w) { game.player.weapon = w; setWeapon(w); }
    };
    const ku = (e: KeyboardEvent) => { if (e.key === "Tab") { e.preventDefault(); setShowScores(false); } };
    const lc = () => {
      const l = !!document.pointerLockElement;
      setLocked(l);
      paused.current = !l;
      if (!l) stopGameVoice();
      if (l) setStarted(true);
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    document.addEventListener("pointerlockchange", lc);
    return () => {
      clearInterval(id);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      document.removeEventListener("pointerlockchange", lc);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, [game]);

  const shareLink = room && typeof window !== "undefined" ? `${window.location.origin}/?room=${room}` : "";
  const rows = showScores ? scoreboard(game) : [];

  return (
    <div ref={wrap} className="relative h-screen w-screen overflow-hidden bg-background select-none">
      <Canvas shadows camera={{ fov: 75, near: 0.05, far: 1800 }}>
        <RigEnvironment />
        <OilRig />
        <Bots game={game} />
        {mode === "online" && room && <Network game={game} room={room} onRoster={setPlayers} />}
        <Shots game={game} />
        <Player game={game} weapon={weapon} paused={paused} />
        <Ready />
      </Canvas>

      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl font-bold text-hud">+</div>

      <div className="pointer-events-none absolute right-4 top-4 space-y-1 text-right font-mono text-sm">
        {hud.feed.map((f, i) => <div key={i} className="rounded bg-hud-panel px-2 py-1 text-hud">{f}</div>)}
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 rounded bg-hud-panel px-4 py-2 font-mono text-3xl font-bold text-hud">✚ {hud.hp}</div>
      <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded bg-hud-panel px-4 py-1 font-mono text-lg text-hud">
        Drap {hud.kills} · Død {hud.deaths}{mode === "online" && ` · Rom ${room} (${players}/${MAX_ROOM})`}
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 space-y-1 rounded bg-hud-panel p-3 font-mono text-sm text-hud">
        {WEAPON_IDS.map((id) => (
          <div key={id} className={id === weapon ? "font-bold text-hud-accent" : "opacity-60"}>[{WEAPONS[id].key}] {WEAPONS[id].name}</div>
        ))}
      </div>

      {hud.dead > 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-hud-danger">
          <div className="font-mono text-5xl font-bold text-hud">Du ble fisket! 🐟</div>
        </div>
      )}

      {showScores && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="w-[min(520px,90vw)] rounded-lg bg-hud-panel-strong p-6 font-mono text-hud">
            <h2 className="mb-4 text-center text-2xl font-bold">Poengtavle</h2>
            <div className="grid grid-cols-[1fr_4rem_4rem] gap-y-1 text-sm">
              <div className="opacity-60">Spiller</div><div className="text-right opacity-60">Drap</div><div className="text-right opacity-60">Død</div>
              {rows.map((r, i) => (
                <div key={i} className={`contents ${r.me ? "font-bold text-hud-accent" : ""}`}>
                  <div className="truncate">{r.name}{r.me && " (deg)"}</div>
                  <div className="text-right">{r.kills}</div>
                  <div className="text-right">{r.deaths}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!locked && hud.dead <= 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-hud-panel text-center font-mono text-hud">
          <h1 className="max-w-full px-4 text-3xl font-bold sm:text-5xl">{started ? "Pause" : "Norge Simulator 2026"}</h1>
          {mode === "online" && (
            <div className="mt-2 space-y-2">
              <p className="text-sm opacity-80">Romkode: <span className="text-hud-accent text-lg font-bold">{room}</span> · {players} spillere</p>
              <button
                className="rounded border border-hud px-3 py-1 text-sm hover:bg-hud-panel"
                onClick={() => { navigator.clipboard?.writeText(shareLink); setCopied(true); }}
              >
                {copied ? "Lenke kopiert!" : "Kopier invitasjonslenke"}
              </button>
            </div>
          )}
          <button className="mt-4 w-56 rounded bg-hud-accent px-6 py-3 text-lg font-bold text-hud-ink hover:opacity-90" onClick={lock}>
            {started ? "Fortsett" : "Spill"}
          </button>
          <button className="w-56 rounded border border-hud px-6 py-2 hover:bg-hud-panel" onClick={onExit}>
            Tilbake til menyen
          </button>
          <p className="mt-4 text-sm opacity-80">WASD = gå · Mus = sikt · Klikk = skyt · Mellomrom = hopp · Shift = sprint · 1-4 = bytt fisk · Tab = poeng · Esc = pause</p>
        </div>
      )}
    </div>
  );
}
