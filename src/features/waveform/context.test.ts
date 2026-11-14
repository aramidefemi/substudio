import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadDocument, useSubtitles } from "@/features/subtitles/store";
import { insertHere, menuTarget, setPointerTime, splitHere } from "./context";

const cues = [
  { id: "a", start: 1, end: 2, text: "a" },
  { id: "b", start: 3, end: 4, text: "b" },
  { id: "c", start: 5, end: 6, text: "c" },
];

describe("menuTarget", () => {
  it("offers insert on empty space only", () => {
    expect(menuTarget(cues, 2.5)).toMatchObject({ cueId: null, canInsert: true, canSplit: false, canMergeNext: false });
  });

  it("offers split and merges on a cue", () => {
    expect(menuTarget(cues, 3.5)).toMatchObject({
      cueId: "b",
      canInsert: false,
      canSplit: true,
      canMergePrevious: true,
      canMergeNext: true,
    });
  });

  it("knows the first and last cue have no previous / next", () => {
    expect(menuTarget(cues, 1.5)).toMatchObject({ canMergePrevious: false, canMergeNext: true });
    expect(menuTarget(cues, 5.5)).toMatchObject({ canMergePrevious: true, canMergeNext: false });
  });

  it("won't split right at an edge", () => {
    expect(menuTarget(cues, 3.01).canSplit).toBe(false);
  });
});

describe("position-aware commands", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    loadDocument(
      cues.map(({ start, end, text }) => ({ start, end, text })),
      null,
    );
  });

  it("inserts at the right-clicked time", () => {
    setPointerTime(2.3);
    insertHere();
    const s = useSubtitles.getState();
    expect(s.cues).toHaveLength(4);
    expect(s.cues[1]!.start).toBe(2.3);
    expect(s.selectedId).toBe(s.cues[1]!.id);
  });

  it("splits the cue under the right-clicked time", () => {
    setPointerTime(3.25);
    splitHere();
    const times = useSubtitles.getState().cues.map((c) => [c.start, c.end]);
    expect(times).toEqual([
      [1, 2],
      [3, 3.25],
      [3.25, 4],
      [5, 6],
    ]);
  });

  it("does nothing when splitting empty space", () => {
    setPointerTime(2.5);
    splitHere();
    expect(useSubtitles.getState().cues).toHaveLength(3);
  });
});
