import { describe, expect, it } from "vitest";
import {
  CUSTOM_STEP,
  MIN_GAP,
  MS_STEP,
  extendNextStartToSelected,
  extendPreviousEndToSelected,
  extendToNext,
  extendToPrevious,
  frameStep,
  nudgeEdge,
  setEndAndStartOfNext,
  setEndAt,
  setStartAndEndOfPrevious,
  setStartAt,
  shiftAll,
  shiftIndices,
  snapAllToFrames,
  snapToFrame,
  stepFrames,
} from "./timing";
import type { CueData } from "./types";

const cue = (start: number, end: number, text = ""): CueData => ({ start, end, text });

describe("snapToFrame", () => {
  it("rounds to nearest frame at project fps", () => {
    expect(snapToFrame(0.03, 25)).toBeCloseTo(0.04);
    expect(snapToFrame(1.02, 25)).toBeCloseTo(1.04); // 1.02s → frame 25.5 → 26/25
  });
});

describe("stepFrames", () => {
  it("steps whole frames from a frame boundary", () => {
    expect(stepFrames(1, 25, 1)).toBeCloseTo(1.04);
    expect(stepFrames(1, 25, -1)).toBeCloseTo(0.96);
    expect(stepFrames(1, 25, 5)).toBeCloseTo(1.2);
  });

  it("lands on the grid from mid-frame", () => {
    expect(stepFrames(1.01, 25, 1)).toBeCloseTo(1.04);
    expect(stepFrames(1.01, 25, -1)).toBeCloseTo(1); // back to the start of the current frame
  });

  it("is stable when repeated (no float drift)", () => {
    let t = 0;
    for (let i = 0; i < 1000; i++) t = stepFrames(t, 25, 1);
    expect(t).toBeCloseTo(40, 9);
    for (let i = 0; i < 1000; i++) t = stepFrames(t, 30, -1);
    expect(t).toBeCloseTo(40 - 1000 / 30, 9);
  });

  it("clamps at zero and ignores a zero step", () => {
    expect(stepFrames(0.02, 25, -1)).toBe(0);
    expect(stepFrames(0, 25, -1)).toBe(0);
    expect(stepFrames(1.234, 25, 0)).toBe(1.234);
  });
});

describe("nudgeEdge", () => {
  it("nudges start/end plainly", () => {
    const cues = [cue(1, 2), cue(3, 4)];
    nudgeEdge(cues, 0, "start", 0.1, "plain");
    expect(cues[0]!.start).toBeCloseTo(1.1);
    nudgeEdge(cues, 0, "end", -0.2, "plain");
    expect(cues[0]!.end).toBeCloseTo(1.8);
  });

  it("keeps gap to previous when moving start", () => {
    const cues = [cue(0, 1), cue(1 + MIN_GAP, 3)];
    const gap = cues[1]!.start - cues[0]!.end;
    nudgeEdge(cues, 1, "start", 0.2, "keepGap");
    expect(cues[1]!.start - cues[0]!.end).toBeCloseTo(gap);
  });

  it("pushes neighbours instead of overlapping", () => {
    const cues = [cue(0, 1), cue(1.1, 2)];
    nudgeEdge(cues, 1, "start", -0.5, "push");
    expect(cues[1]!.start).toBeLessThan(1.1);
    expect(cues[0]!.end + MIN_GAP).toBeLessThanOrEqual(cues[1]!.start + 1e-9);
  });
});

describe("shiftIndices / shiftAll", () => {
  it("moves selected only, or with following", () => {
    const cues = [cue(0, 1), cue(2, 3), cue(4, 5)];
    shiftIndices(cues, [1], 0.5, false);
    expect(cues.map((c) => c.start)).toEqual([0, 2.5, 4]);
    shiftIndices(cues, [1], 0.5, true);
    expect(cues.map((c) => c.start)).toEqual([0, 3, 4.5]);
  });

  it("moves all lines", () => {
    const cues = [cue(1, 2), cue(3, 4)];
    shiftAll(cues, -0.5);
    expect(cues[0]!.start).toBeCloseTo(0.5);
    expect(cues[1]!.start).toBeCloseTo(2.5);
  });
});

describe("set start/end chaining", () => {
  it("sets start with keep duration and offset rest", () => {
    const a = [cue(1, 3), cue(4, 5)];
    setStartAt(a, 0, 2, { keepDuration: true });
    expect(a[0]).toMatchObject({ start: 2, end: 4 });

    const b = [cue(1, 2), cue(3, 4)];
    setStartAt(b, 0, 2, { offsetRest: true });
    expect(b.map((c) => c.start)).toEqual([2, 4]);
  });

  it("sets end and start of next after gap", () => {
    const cues = [cue(0, 1), cue(2, 3)];
    expect(setEndAndStartOfNext(cues, 0, 1.5)).toBe(true);
    expect(cues[0]!.end).toBeCloseTo(1.5);
    expect(cues[1]!.start).toBeCloseTo(1.5 + MIN_GAP);
    expect(cues[1]!.end - cues[1]!.start).toBeCloseTo(1);
  });

  it("sets start and end of previous minus gap", () => {
    const cues = [cue(0, 1), cue(2, 3)];
    expect(setStartAndEndOfPrevious(cues, 1, 1.5)).toBe(true);
    expect(cues[1]!.start).toBeCloseTo(1.5);
    expect(cues[0]!.end).toBeCloseTo(1.5 - MIN_GAP);
  });

  it("sets end at video position", () => {
    const cues = [cue(0, 2)];
    setEndAt(cues, 0, 1.2);
    expect(cues[0]!.end).toBeCloseTo(1.2);
  });
});

describe("extend", () => {
  it("extends to previous/next and pulls neighbours", () => {
    const cues = [cue(0, 1), cue(2, 3), cue(5, 6)];
    extendToPrevious(cues, 1);
    expect(cues[1]!.start).toBeCloseTo(1 + MIN_GAP);
    extendToNext(cues, 1);
    expect(cues[1]!.end).toBeCloseTo(5 - MIN_GAP);

    const b = [cue(0, 0.5), cue(2, 3)];
    extendPreviousEndToSelected(b, 1);
    expect(b[0]!.end).toBeCloseTo(2 - MIN_GAP);
    extendNextStartToSelected(b, 0);
    expect(b[1]!.start).toBeCloseTo(b[0]!.end + MIN_GAP);
  });
});

describe("snapAllToFrames", () => {
  it("aligns every edge to the frame grid", () => {
    const cues = [cue(0.03, 1.07), cue(2.02, 3.11)];
    snapAllToFrames(cues, 25);
    for (const c of cues) {
      expect(c.start * 25).toBeCloseTo(Math.round(c.start * 25));
      expect(c.end * 25).toBeCloseTo(Math.round(c.end * 25));
    }
  });
});

describe("steps", () => {
  it("exposes frame / ms / custom sizes", () => {
    expect(frameStep(25)).toBeCloseTo(0.04);
    expect(MS_STEP).toBeCloseTo(0.1);
    expect(CUSTOM_STEP).toBeCloseTo(0.025);
  });
});
