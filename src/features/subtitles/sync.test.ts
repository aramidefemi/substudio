import { beforeEach, describe, expect, it } from "vitest";
import { loadDocument, redo, undo, useSubtitles } from "./store";
import {
  anchorAt,
  anchorsMonotonic,
  countRemapped,
  mapThroughAnchors,
  normalizeAnchors,
  remapCues,
  type SyncAnchor,
} from "./sync";
import { applyPointSync } from "./syncEdits";
import { MIN_GAP } from "./timing";
import type { CueData } from "./types";

const cue = (start: number, end = start + 1, text = ""): CueData => ({ start, end, text });

describe("normalizeAnchors / anchorsMonotonic", () => {
  it("needs at least two distinct cues", () => {
    expect(normalizeAnchors([])).toBeNull();
    expect(normalizeAnchors([{ index: 0, subTime: 1, videoTime: 2 }])).toBeNull();
    expect(
      normalizeAnchors([
        { index: 0, subTime: 1, videoTime: 2 },
        { index: 0, subTime: 1, videoTime: 3 },
      ]),
    ).toBeNull();
  });

  it("sorts by subTime and keeps the last write per index", () => {
    const pts = normalizeAnchors([
      { index: 2, subTime: 5, videoTime: 6 },
      { index: 0, subTime: 1, videoTime: 1.5 },
      { index: 2, subTime: 5, videoTime: 7 },
    ]);
    expect(pts?.map((p) => [p.index, p.videoTime])).toEqual([
      [0, 1.5],
      [2, 7],
    ]);
  });

  it("rejects equal subtitle times and non-monotonic video times", () => {
    expect(
      normalizeAnchors([
        { index: 0, subTime: 1, videoTime: 1 },
        { index: 1, subTime: 1, videoTime: 2 },
      ]),
    ).toBeNull();
    expect(
      anchorsMonotonic([
        { index: 0, subTime: 1, videoTime: 3 },
        { index: 1, subTime: 2, videoTime: 2 },
      ]),
    ).toBe(false);
    expect(
      anchorsMonotonic([
        { index: 0, subTime: 1, videoTime: 1 },
        { index: 1, subTime: 2, videoTime: 3 },
      ]),
    ).toBe(true);
  });
});

describe("mapThroughAnchors", () => {
  const two: SyncAnchor[] = [
    { index: 0, subTime: 10, videoTime: 12 },
    { index: 1, subTime: 20, videoTime: 22 },
  ];

  it("hits anchors exactly and interpolates in between", () => {
    expect(mapThroughAnchors(10, two)).toBe(12);
    expect(mapThroughAnchors(20, two)).toBe(22);
    expect(mapThroughAnchors(15, two)).toBe(17);
  });

  it("extrapolates outside the first/last segment", () => {
    expect(mapThroughAnchors(5, two)).toBe(7);
    expect(mapThroughAnchors(25, two)).toBe(27);
  });

  it("piecewise-maps through three anchors", () => {
    const three: SyncAnchor[] = [
      { index: 0, subTime: 0, videoTime: 0 },
      { index: 1, subTime: 10, videoTime: 20 },
      { index: 2, subTime: 20, videoTime: 25 },
    ];
    expect(mapThroughAnchors(5, three)).toBe(10);
    expect(mapThroughAnchors(15, three)).toBe(22.5);
    expect(mapThroughAnchors(30, three)).toBe(30); // slope 0.5 after last
  });
});

describe("remapCues", () => {
  it("scales a block linearly between two points", () => {
    const cues = [cue(10, 11), cue(15, 16), cue(20, 21)];
    const after = remapCues(cues, [
      { index: 0, subTime: 10, videoTime: 12 },
      { index: 2, subTime: 20, videoTime: 32 },
    ]);
    expect(after?.map((c) => [c.start, c.end])).toEqual([
      [12, 14],
      [22, 24],
      [32, 34],
    ]);
    expect(countRemapped(cues, after!)).toBe(3);
  });

  it("clamps below zero and keeps MIN_GAP", () => {
    const cues = [cue(2, 2.01)];
    // slope = (5-0)/(12-2) = 0.5; start 2 → 0; end 2.01 → 0.005 → MIN_GAP
    const after = remapCues(cues, [
      { index: 0, subTime: 2, videoTime: 0 },
      { index: 99, subTime: 12, videoTime: 5 },
    ]);
    expect(after?.[0]).toEqual({ start: 0, end: MIN_GAP, text: "" });
  });

  it("returns null for bad anchors", () => {
    expect(remapCues([cue(1)], [{ index: 0, subTime: 1, videoTime: 2 }])).toBeNull();
    expect(
      remapCues([cue(1), cue(2)], [
        { index: 0, subTime: 1, videoTime: 5 },
        { index: 1, subTime: 2, videoTime: 4 },
      ]),
    ).toBeNull();
  });

  it("anchorAt reads the cue start", () => {
    expect(anchorAt([cue(3.5, 4)], 0, 9)).toEqual({ index: 0, subTime: 3.5, videoTime: 9 });
    expect(anchorAt([cue(1)], 1, 2)).toBeNull();
    expect(anchorAt([cue(1)], 0, -1)).toBeNull();
  });
});

describe("applyPointSync", () => {
  beforeEach(() =>
    loadDocument(
      [10, 15, 20, 25].map((s, i) => ({ start: s, end: s + 1, text: `L${i}` })),
      null,
    ),
  );

  const starts = () => useSubtitles.getState().cues.map((c) => c.start);

  it("applies in one undo step and keeps sort order", () => {
    const n = applyPointSync([
      { index: 0, subTime: 10, videoTime: 0 },
      { index: 3, subTime: 25, videoTime: 30 },
    ]);
    expect(n).toBe(4);
    expect(starts().map((s) => +s.toFixed(6))).toEqual([0, 10, 20, 30]);
    undo();
    expect(starts()).toEqual([10, 15, 20, 25]);
    redo();
    expect(starts().map((s) => +s.toFixed(6))).toEqual([0, 10, 20, 30]);
  });

  it("does nothing for invalid anchors", () => {
    expect(applyPointSync([{ index: 0, subTime: 10, videoTime: 1 }])).toBe(0);
    expect(starts()).toEqual([10, 15, 20, 25]);
  });
});
