import { describe, expect, it } from "vitest";
import { nextSpeed } from "./transport";

describe("nextSpeed", () => {
  it("steps through the offered speeds and stops at the ends", () => {
    expect(nextSpeed(1, 1)).toBe(1.25);
    expect(nextSpeed(1, -1)).toBe(0.75);
    expect(nextSpeed(2, 1)).toBe(2);
    expect(nextSpeed(0.5, -1)).toBe(0.5);
  });

  it("snaps an off-list rate to the neighbouring speed", () => {
    expect(nextSpeed(1.1, 1)).toBe(1.25);
    expect(nextSpeed(1.1, -1)).toBe(1);
  });
});
