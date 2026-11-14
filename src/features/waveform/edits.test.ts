import { beforeEach, describe, expect, it } from "vitest";
import { loadDocument, setCueTimes, undo, useSubtitles } from "@/features/subtitles/store";

const times = () => useSubtitles.getState().cues.map((c) => [c.start, c.end]);
const ids = () => useSubtitles.getState().cues.map((c) => c.id);

beforeEach(() => {
  loadDocument(
    [
      { start: 0, end: 1, text: "a" },
      { start: 2, end: 3, text: "b" },
    ],
    null,
  );
});

describe("setCueTimes", () => {
  it("collapses one drag gesture into one undo step", () => {
    const [a, b] = ids();
    setCueTimes([{ id: b!, start: 1.8 }], "drag:1");
    setCueTimes([{ id: b!, start: 1.5 }, { id: a!, end: 0.9 }], "drag:1");
    setCueTimes([{ id: b!, start: 1.4 }, { id: a!, end: 1 }], "drag:1");
    expect(times()).toEqual([
      [0, 1],
      [1.4, 3],
    ]);
    expect(useSubtitles.getState().past).toHaveLength(1);
    undo();
    expect(times()).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it("keeps separate gestures as separate undo steps", () => {
    const [, b] = ids();
    setCueTimes([{ id: b!, end: 3.5 }], "drag:1");
    setCueTimes([{ id: b!, end: 4 }], "drag:2");
    expect(useSubtitles.getState().past).toHaveLength(2);
  });

  it("adds no history when nothing changes", () => {
    const [a] = ids();
    setCueTimes([{ id: a!, start: 0, end: 1 }], "drag:1");
    expect(useSubtitles.getState().past).toHaveLength(0);
  });
});
