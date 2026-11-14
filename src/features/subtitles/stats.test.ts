import { describe, expect, it } from "vitest";
import { compareCues, diffSummary } from "./compare";
import { computeStats, cpsHistogram } from "./stats";

const cues = [
  { start: 0, end: 2, text: "Hello world" },
  { start: 2.5, end: 4.5, text: "Fast\nline" },
  { start: 4.4, end: 6, text: "Overlap" },
];

describe("computeStats", () => {
  it("totals lines, chars, words, overlaps", () => {
    const s = computeStats(cues);
    expect(s.lines).toBe(3);
    expect(s.words).toBe(5);
    expect(s.overlaps).toBe(1);
    expect(s.totalDuration).toBeCloseTo(5.6, 5);
  });
});

describe("cpsHistogram", () => {
  it("buckets by cps", () => {
    const h = cpsHistogram([{ start: 0, end: 10, text: "abcdefghij" }]); // 1 cps
    expect(h[0]!.count).toBe(1);
    expect(h.reduce((a, b) => a + b.count, 0)).toBe(1);
  });
});

describe("compareCues", () => {
  it("marks same, changed, and only-side rows", () => {
    const left = [
      { start: 0, end: 1, text: "a" },
      { start: 1, end: 2, text: "b" },
    ];
    const right = [
      { start: 0, end: 1, text: "a" },
      { start: 1, end: 2, text: "B" },
      { start: 2, end: 3, text: "c" },
    ];
    const rows = compareCues(left, right);
    expect(diffSummary(rows)).toEqual({
      same: 1,
      changed: 1,
      onlyLeft: 0,
      onlyRight: 1,
      total: 3,
    });
  });
});
