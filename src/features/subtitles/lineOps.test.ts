import { describe, expect, it } from "vitest";
import {
  fitCueInGap,
  mergeMany,
  mergeTexts,
  rippleSpan,
  splitCueAtCursor,
  splitCueAtTime,
  splitTextAt,
} from "./lineOps";

describe("mergeTexts", () => {
  it("keeps breaks, unbreaks, and makes dialog", () => {
    expect(mergeTexts("A", "B", "keepBreaks")).toBe("A\nB");
    expect(mergeTexts("A\nline", "B", "unbreak")).toBe("A line B");
    expect(mergeTexts("Hello", "Hi", "dialog")).toBe("- Hello\n- Hi");
    expect(mergeMany(["A", "B", "C"], "dialog")).toBe("- A\n- B\n- C");
  });
});

describe("splitTextAt / splitCue", () => {
  it("splits text at the caret", () => {
    expect(splitTextAt("hello world", 5)).toEqual(["hello", "world"]);
  });

  it("splits times at an absolute point", () => {
    const out = splitCueAtTime({ start: 0, end: 4, text: "ab" }, 2, "a", "b");
    expect(out).toEqual({
      left: { start: 0, end: 2, text: "a" },
      right: { start: 2, end: 4, text: "b" },
    });
  });

  it("splits at cursor with proportional times", () => {
    const out = splitCueAtCursor({ start: 0, end: 4, text: "aa bb" }, 2);
    expect(out!.left.text).toBe("aa");
    expect(out!.right.text).toBe("bb");
    expect(out!.left.end).toBeCloseTo(out!.right.start);
    expect(out!.left.end).toBeGreaterThan(0);
    expect(out!.left.end).toBeLessThan(4);
  });
});

describe("fitCueInGap / rippleSpan", () => {
  it("fits inside a gap or returns null", () => {
    expect(fitCueInGap(1, 4, 2)).toEqual({ start: 1, end: 3 });
    expect(fitCueInGap(1, 1.05, 2)).toBeNull();
  });

  it("measures the selected span for ripple", () => {
    const cues = [
      { start: 0, end: 1, text: "a" },
      { start: 2, end: 3, text: "b" },
      { start: 4, end: 5, text: "c" },
    ];
    expect(rippleSpan(cues, [0, 1])).toBe(3);
  });
});
