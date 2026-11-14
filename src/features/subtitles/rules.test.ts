import { describe, expect, it } from "vitest";
import { checkCue, cueStats } from "./rules";

describe("cueStats", () => {
  it("counts characters per line and reading speed", () => {
    const s = cueStats({ start: 0, end: 2, text: "Hello\nthere" });
    expect(s.lineLengths).toEqual([5, 5]);
    expect(s.cps).toBe(5);
  });
});

describe("checkCue", () => {
  it("passes a comfortable cue", () => {
    expect(checkCue({ start: 0, end: 2, text: "In Jesus' name." }, undefined)).toEqual({});
  });

  it("flags short, fast and overlapping cues", () => {
    const prev = { start: 0, end: 1.5, text: "One" };
    const issues = checkCue({ start: 1.2, end: 1.9, text: "My child, why are you crying?" }, prev);
    expect(issues.start).toMatch(/Overlaps/);
    expect(issues.duration).toMatch(/Too short/);
    expect(issues.text).toMatch(/Reads too fast/);
  });

  it("flags long cues like a 37-second song", () => {
    expect(checkCue({ start: 0, end: 37.8, text: "(Singing)" }, undefined).duration).toMatch(/Too long/);
  });
});
