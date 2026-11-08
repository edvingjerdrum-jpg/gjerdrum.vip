import type { Game } from "./sim";

const PHRASES = ["Au!", "Au au!", "Aiai!", "Uff!", "Au, det gjorde vondt!", "Æsj, fisk!", "Nei, ikke fisken!"];
const MIN_GAP = 0.35; // seconds between voices so it doesn't turn into noise
let last = 0;

/** Say "au" in Norwegian for queued hits, louder the closer they are. */
export function playOuches(g: Game, now: number) {
  if (g.ouches.length === 0) return;
  const hits = g.ouches.splice(0);
  if (typeof speechSynthesis === "undefined" || now - last < MIN_GAP) return;
  const p = g.player.pos;
  const near = hits.reduce((a, b) => (Math.hypot(a.x - p.x, a.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? a : b));
  const dist = Math.hypot(near.x - p.x, near.z - p.z);
  if (dist > 40) return;
  last = now;
  const u = new SpeechSynthesisUtterance(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
  u.lang = "nb-NO";
  const voice = speechSynthesis.getVoices().find((v) => /^(nb|no|nn)/i.test(v.lang));
  if (voice) u.voice = voice;
  u.pitch = 0.8 + Math.random() * 0.9;
  u.rate = 1.2;
  u.volume = Math.max(0.15, 1 - dist / 40);
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
