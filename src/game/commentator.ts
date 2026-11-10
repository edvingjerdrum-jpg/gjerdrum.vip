import type { Game } from "./sim";
import { speakNorwegian } from "./voice";

export type CommentaryEvent = "start" | "kill" | "death" | "respawn" | "danger" | "action";
type Snapshot = { kills: number; deaths: number; dead: boolean; hp: number; feed: string | undefined };
export type CommentaryState = { previous: Snapshot | null; pending: CommentaryEvent | null; last: number };
export const createCommentary = (): CommentaryState => ({ previous: null, pending: null, last: -Infinity });

/** Pure event detection works for solo and online scores without changing combat. */
export function detectCommentary(state: CommentaryState, game: Game): CommentaryEvent | null {
  const current = { kills: game.kills, deaths: game.deaths, dead: game.player.dead > 0, hp: game.player.hp, feed: game.feed[0] };
  const previous = state.previous;
  state.previous = current;
  if (!previous) return "start";
  if (current.deaths > previous.deaths) return "death";
  if (current.kills > previous.kills) return "kill";
  if (previous.dead && !current.dead) return "respawn";
  if (!current.dead && current.hp <= 25 && previous.hp > 25) return "danger";
  if (current.feed && current.feed !== previous.feed) return "action";
  return null;
}

const lines: Record<CommentaryEvent, string[]> = {
  start: ["Velkommen til oljeriggen! Kampen er i gang. Må den beste fiskeren vinne!"],
  kill: ["Der satt den! For en fangst!", "Rett i garnet! Nydelig fisking!", "Det er ikke torsk, det er klasse!"],
  death: ["Oi oi oi! Du ble fisket. Vi får håpe på en sterk retur!", "Rett på havets bunn! Dette er ikke over!"],
  respawn: ["Tilbake på dekk! Nå er det tid for revansj!"],
  danger: ["Nå er det lite liv igjen! Hold deg i dekning!"],
  action: ["Det smeller på oljeriggen!", "Her flyr fisken i alle retninger!"],
};

export function playCommentary(state: CommentaryState, game: Game, now: number) {
  const event = detectCommentary(state, game);
  if (event) state.pending = event;
  if (!state.pending || now - state.last < 4) return;
  const options = lines[state.pending];
  const text = options[Math.floor(Math.random() * options.length)];
  if (text && speakNorwegian(text, true, 0.85)) { state.pending = null; state.last = now; }
}