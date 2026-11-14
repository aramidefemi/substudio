import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadDocument, useSubtitles } from "@/features/subtitles/store";
import { clearRegion, createCueFromRegion, gapAround, regionContains, regionFromDrag, setRegion, useRegion } from "./region";

const cues = [
  { start: 1, end: 2 },
  { start: 4, end: 5 },
];

describe("gapAround", () => {
  it("finds the empty stretch between neighbours", () => {
    expect(gapAround(cues, 3)).toEqual({ lo: 2, hi: 4 });
    expect(gapAround(cues, 0.5)).toEqual({ lo: 0, hi: 1 });
    expect(gapAround(cues, 9)).toEqual({ lo: 5, hi: Infinity });
    expect(gapAround([], 9)).toEqual({ lo: 0, hi: Infinity });
  });

  it("is null inside a cue", () => {
    expect(gapAround(cues, 1.5)).toBeNull();
  });
});

describe("regionFromDrag", () => {
  const gap = { lo: 2, hi: 4 };
  it("spans press to pointer in either direction", () => {
    expect(regionFromDrag(2.5, 3.25, gap)).toEqual({ start: 2.5, end: 3.25 });
    expect(regionFromDrag(3.25, 2.5, gap)).toEqual({ start: 2.5, end: 3.25 });
  });
  it("stays inside the gap", () => {
    expect(regionFromDrag(3, 9, gap)).toEqual({ start: 3, end: 4 });
    expect(regionFromDrag(3, 0, gap)).toEqual({ start: 2, end: 3 });
  });
  it("rounds to milliseconds", () => {
    expect(regionFromDrag(2.00049, 3.12345, gap)).toEqual({ start: 2, end: 3.123 });
  });
});

describe("regionContains", () => {
  it("checks bounds and null", () => {
    expect(regionContains({ start: 1, end: 2 }, 1.5)).toBe(true);
    expect(regionContains({ start: 1, end: 2 }, 2.5)).toBe(false);
    expect(regionContains(null, 1)).toBe(false);
  });
});

describe("createCueFromRegion", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    loadDocument(
      [
        { start: 1, end: 2, text: "a" },
        { start: 4, end: 5, text: "b" },
      ],
      null,
    );
    clearRegion();
  });

  it("does nothing without a region", () => {
    expect(createCueFromRegion()).toBe(false);
    expect(useSubtitles.getState().cues).toHaveLength(2);
  });

  it("creates a selected cue with exactly the region's times and clears it", () => {
    setRegion({ start: 2.5, end: 3.75 });
    expect(createCueFromRegion()).toBe(true);
    const s = useSubtitles.getState();
    expect(s.cues.map((c) => [c.start, c.end])).toEqual([
      [1, 2],
      [2.5, 3.75],
      [4, 5],
    ]);
    expect(s.selectedId).toBe(s.cues[1]!.id);
    expect(s.past).toHaveLength(1);
    expect(useRegion.getState().region).toBeNull();
  });
});
