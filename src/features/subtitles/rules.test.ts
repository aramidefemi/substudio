import { describe, expect, it } from "vitest";
import { checkCue, cueStats, DEFAULT_RULES, listIssues } from "./rules";

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

  it("flags too many lines and reports every text problem", () => {
    const text = "Mo ti rí ọmọ náà\nní ọjà Ọ̀yọ́\nlánàá";
    expect(checkCue({ start: 0, end: 3, text }, undefined).text).toBe("Too many lines: 3 (max 2)");
    const both = checkCue({ start: 0, end: 1, text: "A very long line that keeps on going past the limit" }, undefined);
    expect(both.text).toMatch(/Reads too fast.*; Line too long: 51 chars/);
  });

  it("flags long cues like a 37-second song", () => {
    expect(checkCue({ start: 0, end: 37.8, text: "(Singing)" }, undefined).duration).toMatch(/Too long/);
  });

  it("skips timing checks for untimed script lines", () => {
    const cue = { start: 0, end: 0, text: "Hello", untimed: true as const };
    expect(checkCue(cue, undefined)).toEqual({});
    expect(checkCue(cue, { start: 0, end: 5, text: "prev" })).toEqual({});
  });

  it("flags a gap shorter than minGap when the profile asks for one", () => {
    const prev = { start: 0, end: 2, text: "One" };
    const cue = { start: 2.02, end: 4, text: "Two" };
    expect(checkCue(cue, prev).start).toBeUndefined();
    expect(checkCue(cue, prev, { ...DEFAULT_RULES, minGap: 0.08 }).start).toMatch(/Gap too short/);
  });
});

describe("listIssues", () => {
  it("lists every flagged column in document order", () => {
    const cues = [
      { start: 0, end: 2, text: "Fine." },
      { start: 1.5, end: 2.2, text: "Overlap and short" },
      { start: 3, end: 5, text: "Fine again." },
      { start: 6, end: 50, text: "(Singing)" },
    ];
    expect(listIssues(cues).map((i) => [i.index, i.column])).toEqual([
      [1, "start"],
      [1, "duration"],
      [1, "text"],
      [3, "duration"],
    ]);
    expect(listIssues(cues)[3]!.reason).toMatch(/Too long/);
  });

  it("is empty for a clean document", () => {
    expect(listIssues([{ start: 0, end: 2, text: "Amen." }])).toEqual([]);
  });
});
