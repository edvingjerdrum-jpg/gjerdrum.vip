import { describe, expect, it } from "vitest";
import { sprintHeld } from "./controls";

describe("sprint binding", () => {
  it("accepts left and right Shift", () => {
    expect(sprintHeld({ ShiftLeft: true })).toBe(true);
    expect(sprintHeld({ ShiftRight: true })).toBe(true);
  });
  it("does not sprint with Ctrl", () => {
    expect(sprintHeld({ ControlLeft: true, ControlRight: true })).toBe(false);
    expect(sprintHeld({ ShiftLeft: false })).toBe(false);
  });
});