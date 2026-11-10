import { describe, expect, it } from "vitest";
import { MATCH_LENGTH, matchWinner } from "./sim";

describe("match", () => {
  it("lasts 3 minutes", () => expect(MATCH_LENGTH).toBe(180));
  it("highest K/D wins, not most kills", () => {
    const w = matchWinner([
      { name: "A", kills: 10, deaths: 10, me: false },
      { name: "B", kills: 4, deaths: 1, me: true },
    ]);
    expect(w?.name).toBe("B");
  });
});
