import { expect, it } from "vitest";
import { createGame } from "./sim";
import { createCommentary, detectCommentary } from "./commentator";

it("announces start once and detects confirmed kills in either mode", () => {
  for (const mode of ["solo", "online"] as const) {
    const game = createGame(mode, "Edvin"), state = createCommentary();
    expect(detectCommentary(state, game)).toBe("start");
    expect(detectCommentary(state, game)).toBeNull();
    game.kills++;
    expect(detectCommentary(state, game)).toBe("kill");
    expect(detectCommentary(state, game)).toBeNull();
  }
});

it("detects death, respawn and a low-health transition", () => {
  const game = createGame("solo", "Edvin"), state = createCommentary();
  detectCommentary(state, game);
  game.player.hp = 25;
  expect(detectCommentary(state, game)).toBe("danger");
  expect(detectCommentary(state, game)).toBeNull();
  game.deaths++; game.player.dead = 3;
  expect(detectCommentary(state, game)).toBe("death");
  game.player.dead = 0; game.player.hp = 100;
  expect(detectCommentary(state, game)).toBe("respawn");
});