import { beforeEach, describe, expect, it } from "vitest";
import { loadDocument, redo, select, selectRangeTo, toggleSelect, undo, useSubtitles } from "./store";
import {
  countClamped,
  countScaled,
  formatOffset,
  frameRateFactor,
  parseOffset,
  parsePositive,
  scaleIndices,
  scaledTimes,
  scopeIndices,
  shiftedTimes,
} from "./retime";
import { changeFrameRate, rescaleByFactor, shiftByOffset } from "./retimeEdits";
import type { TimeFormat } from "./timecode";
import { MIN_GAP } from "./timing";

const frames: TimeFormat = { mode: "frames", fps: 25 };
const ms: TimeFormat = { mode: "ms", fps: 25 };

describe("parseOffset", () => {
  it("reads full timecodes with a sign", () => {
    expect(parseOffset("+00:00:02:12", frames)).toBeCloseTo(2.48, 9);
    expect(parseOffset("-00:00:02:12", frames)).toBeCloseTo(-2.48, 9);
    expect(parseOffset("−00:00:01,500", ms)).toBeCloseTo(-1.5, 9);
    expect(parseOffset("01:02:03,004", ms)).toBeCloseTo(3723.004, 9);
  });

  it("accepts either unit whatever the display mode", () => {
    expect(parseOffset("00:00:01,250", frames)).toBeCloseTo(1.25, 9);
    expect(parseOffset("00:00:01:05", ms)).toBeCloseTo(1.2, 9);
  });

  it("lets leading fields be left out", () => {
    expect(parseOffset("-2:12", frames)).toBeCloseTo(-2.48, 9);
    expect(parseOffset("1:02,500", ms)).toBeCloseTo(62.5, 9);
    expect(parseOffset("1:00:00:00", frames)).toBe(3600);
    expect(parseOffset(" + 0,040 ", ms)).toBeCloseTo(0.04, 9);
  });

  it("rejects junk and out-of-range frames", () => {
    expect(parseOffset("", frames)).toBeNull();
    expect(parseOffset("abc", frames)).toBeNull();
    expect(parseOffset("2", frames)).toBeNull();
    expect(parseOffset("00:00:01:25", frames)).toBeNull(); // only 0–24 at 25 fps
    expect(parseOffset("+-1,000", ms)).toBeNull();
  });

  it("round-trips through formatOffset", () => {
    for (const d of [-2.48, 0, 0.04, 61.2, -3723.36]) {
      expect(parseOffset(formatOffset(d, frames), frames)).toBeCloseTo(d, 9);
    }
    expect(formatOffset(-1.5, ms)).toBe("−00:00:01,500");
    expect(formatOffset(2.48, frames)).toBe("+00:00:02:12");
  });
});

describe("scopeIndices", () => {
  it("covers all, selected, or selected and following", () => {
    expect(scopeIndices(5, [1, 3], "all")).toEqual([0, 1, 2, 3, 4]);
    expect(scopeIndices(5, [1, 3], "selected")).toEqual([1, 3]);
    expect(scopeIndices(5, [3, 1], "selectedAndFollowing")).toEqual([1, 2, 3, 4]);
    expect(scopeIndices(5, [], "selected")).toEqual([]);
    expect(scopeIndices(5, [], "selectedAndFollowing")).toEqual([]);
  });
});

describe("shiftedTimes / countClamped", () => {
  it("clamps at zero like the move commands", () => {
    expect(shiftedTimes({ start: 1, end: 2, text: "" }, 0.5)).toEqual({ start: 1.5, end: 2.5 });
    expect(shiftedTimes({ start: 1, end: 2, text: "" }, -1.5)).toEqual({ start: 0, end: 0.5 });
    expect(shiftedTimes({ start: 1, end: 2, text: "" }, -3)).toEqual({ start: 0, end: MIN_GAP });
    const cues = [0.5, 1, 4].map((s) => ({ start: s, end: s + 1, text: "" }));
    expect(countClamped(cues, [0, 1, 2], -1.2)).toBe(2);
  });
});

describe("shiftByOffset", () => {
  beforeEach(() =>
    loadDocument(
      [1, 3, 5, 7].map((s, i) => ({ start: s, end: s + 1, text: `L${i}` })),
      null,
    ),
  );
  const starts = () => useSubtitles.getState().cues.map((c) => c.start);
  const ids = () => useSubtitles.getState().cues.map((c) => c.id);

  it("shifts all lines in one undo step", () => {
    expect(shiftByOffset("all", 2.48)).toBe(4);
    expect(starts().map((s) => +s.toFixed(3))).toEqual([3.48, 5.48, 7.48, 9.48]);
    expect(useSubtitles.getState().past).toHaveLength(1);
    undo();
    expect(starts()).toEqual([1, 3, 5, 7]);
    redo();
    expect(starts()[0]).toBeCloseTo(3.48, 9);
  });

  it("shifts only the selection, or the selection and what follows", () => {
    const [, b, c] = ids();
    select(b!);
    toggleSelect(c!);
    shiftByOffset("selected", 0.5);
    expect(starts()).toEqual([1, 3.5, 5.5, 7]);
    undo();
    select(c!);
    shiftByOffset("selectedAndFollowing", -1);
    expect(starts()).toEqual([1, 3, 4, 6]);
  });

  it("keeps cues sorted when selected lines move past others", () => {
    const [a] = ids();
    select(a!);
    shiftByOffset("selected", 5);
    expect(starts()).toEqual([3, 5, 6, 7]);
    expect(useSubtitles.getState().cues[2]!.text).toBe("L0");
  });

  it("does nothing for a zero offset or an empty scope", () => {
    selectRangeTo(ids()[0]!);
    expect(shiftByOffset("all", 0)).toBe(0);
    useSubtitles.setState({ selectedIds: [], selectedId: null });
    expect(shiftByOffset("selected", 1)).toBe(0);
    expect(useSubtitles.getState().past).toHaveLength(0);
  });
});

describe("frameRateFactor / scaledTimes", () => {
  it("scales by from÷to and rejects bad rates", () => {
    expect(frameRateFactor(25, 25)).toBe(1);
    expect(frameRateFactor(25, 23.976)!).toBeCloseTo(25 / 23.976, 9);
    expect(frameRateFactor(0, 25)).toBeNull();
    expect(frameRateFactor(25, -1)).toBeNull();
    expect(parsePositive("23.976")).toBe(23.976);
    expect(parsePositive("0")).toBeNull();
    expect(parsePositive("x")).toBeNull();
  });

  it("clamps scaled times like shift", () => {
    expect(scaledTimes({ start: 1, end: 2, text: "" }, 2)).toEqual({ start: 2, end: 4 });
    expect(scaledTimes({ start: 1, end: 2, text: "" }, 0.01)).toEqual({ start: 0.01, end: MIN_GAP + 0.01 });
    const cues = [
      { start: 1, end: 2, text: "a" },
      { start: 3, end: 4, text: "b" },
    ];
    scaleIndices(cues, [0], 2);
    expect(cues[0]).toMatchObject({ start: 2, end: 4 });
    expect(cues[1]).toMatchObject({ start: 3, end: 4 });
    expect(countScaled(cues, [0, 1], 1)).toBe(0);
  });
});

describe("changeFrameRate / rescaleByFactor", () => {
  beforeEach(() => {
    loadDocument(
      [1, 2, 4].map((s, i) => ({ start: s, end: s + 1, text: `L${i}` })),
      null,
    );
    useSubtitles.setState({ fps: 25 });
  });
  const starts = () => useSubtitles.getState().cues.map((c) => c.start);
  const ids = () => useSubtitles.getState().cues.map((c) => c.id);

  it("rescales all lines 25→23.976 and updates project fps in one undo for times", () => {
    expect(changeFrameRate("all", 25, 23.976)).toBe(3);
    const f = 25 / 23.976;
    expect(starts()[0]).toBeCloseTo(1 * f, 9);
    expect(starts()[2]).toBeCloseTo(4 * f, 9);
    expect(useSubtitles.getState().fps).toBe(23.976);
    expect(useSubtitles.getState().past).toHaveLength(1);
    undo();
    expect(starts()).toEqual([1, 2, 4]);
    // Project fps is a setting, not part of the cue undo stack.
    expect(useSubtitles.getState().fps).toBe(23.976);
  });

  it("rescales only the selection without changing project fps", () => {
    const [, b] = ids();
    select(b!);
    expect(changeFrameRate("selected", 25, 50)).toBe(1);
    expect(starts()).toEqual([1, 1, 4]); // 2 * 25/50 = 1
    expect(useSubtitles.getState().fps).toBe(25);
  });

  it("multiplies times by a speed factor and undoes", () => {
    expect(rescaleByFactor("all", 2)).toBe(3);
    expect(starts()).toEqual([2, 4, 8]);
    undo();
    expect(starts()).toEqual([1, 2, 4]);
    redo();
    expect(starts()).toEqual([2, 4, 8]);
  });

  it("skips identity factors and empty scopes", () => {
    expect(rescaleByFactor("all", 1)).toBe(0);
    expect(changeFrameRate("all", 25, 25)).toBe(0);
    expect(useSubtitles.getState().fps).toBe(25);
    useSubtitles.setState({ selectedIds: [], selectedId: null });
    expect(rescaleByFactor("selected", 2)).toBe(0);
    expect(useSubtitles.getState().past).toHaveLength(0);
  });
});
