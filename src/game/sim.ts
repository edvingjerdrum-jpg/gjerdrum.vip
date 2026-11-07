// Pure game rules: no React, no three.js.
export type Vec = { x: number; y: number; z: number };
export type Box = { x: number; z: number; w: number; d: number; h: number; kind: "wall" | "crate" };

export const MAP_SIZE = 60;
export const PLAYER_RADIUS = 0.5;
export const EYE = 1.6;
export const MOVE_SPEED = 7;
export const BOT_SPEED = 3.2;
export const BOT_COUNT = 6;
export const RESPAWN = 3;

export type WeaponId = "sill" | "makrill" | "kugelfisk" | "lax";
export const WEAPONS: Record<WeaponId, { name: string; dmg: number; rate: number; speed: number; spread: number; pellets: number; color: string; size: number; key: string }> = {
  sill: { name: "Sillpistol", dmg: 25, rate: 0.35, speed: 45, spread: 0.01, pellets: 1, color: "#b9c4cc", size: 0.6, key: "1" },
  makrill: { name: "Makrill-AK", dmg: 14, rate: 0.1, speed: 55, spread: 0.035, pellets: 1, color: "#3f7d8c", size: 0.7, key: "2" },
  kugelfisk: { name: "Kugelfisk-hagel", dmg: 12, rate: 0.9, speed: 35, spread: 0.12, pellets: 7, color: "#e0b040", size: 0.5, key: "3" },
  lax: { name: "Lax-AWP", dmg: 100, rate: 1.4, speed: 90, spread: 0, pellets: 1, color: "#f08a6a", size: 1.1, key: "4" },
};

export const BOXES: Box[] = (() => {
  const b: Box[] = [];
  const S = MAP_SIZE / 2;
  b.push({ x: 0, z: -S, w: MAP_SIZE, d: 1, h: 6, kind: "wall" });
  b.push({ x: 0, z: S, w: MAP_SIZE, d: 1, h: 6, kind: "wall" });
  b.push({ x: -S, z: 0, w: 1, d: MAP_SIZE, h: 6, kind: "wall" });
  b.push({ x: S, z: 0, w: 1, d: MAP_SIZE, h: 6, kind: "wall" });
  // dust-like inner walls
  b.push({ x: -10, z: -8, w: 1.5, d: 22, h: 5, kind: "wall" });
  b.push({ x: 10, z: 8, w: 1.5, d: 22, h: 5, kind: "wall" });
  b.push({ x: 0, z: 18, w: 14, d: 1.5, h: 5, kind: "wall" });
  b.push({ x: 0, z: -18, w: 14, d: 1.5, h: 5, kind: "wall" });
  b.push({ x: -20, z: 12, w: 12, d: 1.5, h: 5, kind: "wall" });
  b.push({ x: 20, z: -12, w: 12, d: 1.5, h: 5, kind: "wall" });
  const crates: [number, number, number][] = [
    [0, 0, 2], [2, 0, 1.2], [-4, 6, 2], [5, -6, 2], [-18, -18, 2], [18, 18, 2], [-22, 0, 2],
    [22, 0, 2], [0, 25, 1.5], [0, -25, 1.5], [-5, -12, 1.2], [6, 13, 1.2], [15, -22, 2], [-15, 22, 2],
  ];
  for (const [x, z, s] of crates) b.push({ x, z, w: s, d: s, h: s, kind: "crate" });
  return b;
})();

export type Player = { pos: Vec; yaw: number; pitch: number; hp: number; weapon: WeaponId; cd: number; dead: number };
export type Bot = { pos: Vec; yaw: number; hp: number; dead: number; target: Vec; cd: number; hit: number };
export type Shot = { pos: Vec; vel: Vec; owner: number; dmg: number; kind: WeaponId; life: number; spin: number };
export type Input = { fwd: number; right: number; fire: boolean };

export type Game = { player: Player; bots: Bot[]; shots: Shot[]; kills: number; deaths: number; time: number; feed: string[] };

const SPAWNS: [number, number][] = [[-25, -25], [25, 25], [-25, 25], [25, -25], [0, 10], [0, -10], [-15, 0], [15, 0]];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const randPoint = (): Vec => ({ x: rnd(-27, 27), y: 0, z: rnd(-27, 27) });

export function createGame(): Game {
  const g: Game = {
    player: { pos: { x: -25, y: 0, z: -25 }, yaw: Math.PI * 0.75, pitch: 0, hp: 100, weapon: "makrill", cd: 0, dead: 0 },
    bots: [], shots: [], kills: 0, deaths: 0, time: 0, feed: [],
  };
  for (let i = 0; i < BOT_COUNT; i++) {
    const [x, z] = SPAWNS[(i + 1) % SPAWNS.length];
    g.bots.push({ pos: { x, y: 0, z }, yaw: 0, hp: 100, dead: 0, target: randPoint(), cd: rnd(1, 2), hit: 0 });
  }
  return g;
}

export function collide(p: Vec, r: number) {
  for (const b of BOXES) {
    const hx = b.w / 2 + r, hz = b.d / 2 + r;
    const dx = p.x - b.x, dz = p.z - b.z;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
      const ox = hx - Math.abs(dx), oz = hz - Math.abs(dz);
      if (ox < oz) p.x += Math.sign(dx || 1) * ox;
      else p.z += Math.sign(dz || 1) * oz;
    }
  }
}

function pointInBox(p: Vec) {
  for (const b of BOXES) if (Math.abs(p.x - b.x) < b.w / 2 && Math.abs(p.z - b.z) < b.d / 2 && p.y < b.h && p.y > 0) return true;
  return false;
}

export function lineOfSight(a: Vec, b: Vec) {
  const steps = 30;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointInBox({ x: a.x + (b.x - a.x) * t, y: 1.5, z: a.z + (b.z - a.z) * t })) return false;
  }
  return true;
}

export function aimDir(yaw: number, pitch: number): Vec {
  return { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };
}

function fire(g: Game, from: Vec, dir: Vec, owner: number, kind: WeaponId) {
  const w = WEAPONS[kind];
  for (let i = 0; i < w.pellets; i++) {
    const d = { x: dir.x + rnd(-w.spread, w.spread), y: dir.y + rnd(-w.spread, w.spread), z: dir.z + rnd(-w.spread, w.spread) };
    const l = Math.hypot(d.x, d.y, d.z);
    g.shots.push({
      pos: { x: from.x + (d.x / l) * 0.8, y: from.y + (d.y / l) * 0.8, z: from.z + (d.z / l) * 0.8 },
      vel: { x: (d.x / l) * w.speed, y: (d.y / l) * w.speed, z: (d.z / l) * w.speed },
      owner, dmg: w.dmg, kind, life: 2, spin: rnd(0, 6),
    });
  }
}

export function playerFire(g: Game) {
  const p = g.player;
  if (p.cd > 0 || p.dead > 0) return false;
  p.cd = WEAPONS[p.weapon].rate;
  fire(g, { x: p.pos.x, y: EYE - 0.1, z: p.pos.z }, aimDir(p.yaw, p.pitch), -1, p.weapon);
  return true;
}

const pushFeed = (g: Game, s: string) => { g.feed.unshift(s); g.feed.length = Math.min(g.feed.length, 5); };

export function step(g: Game, dt: number, input: Input) {
  g.time += dt;
  const p = g.player;
  p.cd = Math.max(0, p.cd - dt);
  if (p.dead > 0) {
    p.dead -= dt;
    if (p.dead <= 0) {
      const [x, z] = SPAWNS[Math.floor(Math.random() * SPAWNS.length)];
      p.pos = { x, y: 0, z }; p.hp = 100;
    }
  } else {
    const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
    let mx = -s * input.fwd + c * input.right, mz = -c * input.fwd - s * input.right;
    const l = Math.hypot(mx, mz);
    if (l > 0) { mx /= l; mz /= l; }
    p.pos.x += mx * MOVE_SPEED * dt; p.pos.z += mz * MOVE_SPEED * dt;
    collide(p.pos, PLAYER_RADIUS);
    if (input.fire) playerFire(g);
  }

  g.bots.forEach((b, i) => {
    b.hit = Math.max(0, b.hit - dt);
    if (b.dead > 0) {
      b.dead -= dt;
      if (b.dead <= 0) {
        const [x, z] = SPAWNS[Math.floor(Math.random() * SPAWNS.length)];
        b.pos = { x, y: 0, z }; b.hp = 100; b.target = randPoint();
      }
      return;
    }
    const sees = p.dead <= 0 && Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z) < 35 && lineOfSight(b.pos, p.pos);
    const goal = sees ? p.pos : b.target;
    const dx = goal.x - b.pos.x, dz = goal.z - b.pos.z, dist = Math.hypot(dx, dz);
    b.yaw = Math.atan2(-dx, -dz);
    if (!sees && dist < 1.5) b.target = randPoint();
    if (dist > (sees ? 8 : 0.5)) {
      const ox = b.pos.x, oz = b.pos.z;
      b.pos.x += (dx / dist) * BOT_SPEED * dt; b.pos.z += (dz / dist) * BOT_SPEED * dt;
      collide(b.pos, PLAYER_RADIUS);
      if (Math.hypot(b.pos.x - ox, b.pos.z - oz) < BOT_SPEED * dt * 0.3) b.target = randPoint();
    }
    b.cd -= dt;
    if (sees && b.cd <= 0) {
      b.cd = rnd(0.9, 1.8);
      const from = { x: b.pos.x, y: 1.5, z: b.pos.z };
      const to = { x: p.pos.x - from.x, y: EYE - 0.3 - from.y, z: p.pos.z - from.z };
      const kinds: WeaponId[] = ["sill", "makrill", "kugelfisk"];
      fire(g, from, to, i, kinds[i % 3]);
    }
  });

  for (const s of g.shots) {
    s.life -= dt;
    s.pos.x += s.vel.x * dt; s.pos.y += s.vel.y * dt; s.pos.z += s.vel.z * dt;
    s.spin += dt * 15;
    if (s.pos.y < 0 || pointInBox(s.pos)) { s.life = 0; continue; }
    if (s.owner === -1) {
      for (const b of g.bots) {
        if (b.dead > 0) continue;
        if (Math.hypot(s.pos.x - b.pos.x, s.pos.z - b.pos.z) < 0.6 && s.pos.y < 2.1) {
          s.life = 0; b.hp -= s.pos.y > 1.5 ? s.dmg * 2 : s.dmg; b.hit = 0.15;
          if (b.hp <= 0) { b.dead = RESPAWN; g.kills++; pushFeed(g, `Du 🐟 Bot ${g.bots.indexOf(b) + 1} (${WEAPONS[s.kind].name})`); }
          break;
        }
      }
    } else if (p.dead <= 0 && Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z) < 0.6 && s.pos.y < 1.9) {
      s.life = 0; p.hp -= Math.round(s.dmg * 0.6);
      if (p.hp <= 0) { p.hp = 0; p.dead = RESPAWN; g.deaths++; pushFeed(g, `Bot ${s.owner + 1} 🐟 Du (${WEAPONS[s.kind].name})`); }
    }
  }
  g.shots = g.shots.filter((s) => s.life > 0);
}
