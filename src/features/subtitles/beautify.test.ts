import { describe, expect, it } from "vitest";
import { beautifyCues, DEFAULT_BEAUTIFY } from "./beautify";

describe("beautifyCues", () => {
  it("snaps to frames and enforces min gap", () => {
    const out = beautifyCues(
      [
        { start: 0.01, end: 1.01, text: "A" },
        { start: 1.02, end: 2.02, text: "B" },
      ],
      { ...DEFAULT_BEAUTIFY, bridgeGapsUnder: null, fps: 25 },
    );
    expect(out[0]!.start).toBe(0);
    expect(out[1]!.start).toBeGreaterThanOrEqual(out[0]!.end + 0.04 - 1e-6);
  });

  it("bridges short gaps", () => {
    const out = beautifyCues(
      [
        { start: 0, end: 1, text: "A" },
        { start: 1.2, end: 2, text: "B" },
      ],
      { ...DEFAULT_BEAUTIFY, snapToFrames: false, applyMinGap: true, bridgeGapsUnder: 0.5 },
    );
    expect(out[0]!.end).toBeCloseTo(1.16, 5);
  });
});
