import { describe, expect, it } from "vitest";
import { cursorFor, dragCue, hitTest, MIN_CUE_LEN, setEdgeAt } from "./drag";

// 100 px per second, view starts at 0: x = t * 100.
const PPS = 100;
const cues = [
  { start: 1, end: 2 },
  { start: 2, end: 3 }, // touches the first
  { start: 4, end: 4.05 }, // 5 px wide
];

describe("hitTest", () => {
  it("grabs edges within ±5 px", () => {
    expect(hitTest(cues, 96, 0, PPS)).toEqual({ index: 0, mode: "start" });
    expect(hitTest(cues, 104, 0, PPS)).toEqual({ index: 0, mode: "start" });
    expect(hitTest(cues, 94, 0, PPS)).toBeNull();
  });

  it("grabs the middle to move", () => {
    expect(hitTest(cues, 150, 0, PPS)).toEqual({ index: 0, mode: "move" });
    expect(hitTest(cues, 250, 0, PPS)).toEqual({ index: 1, mode: "move" });
  });

  it("returns null on empty space", () => {
    expect(hitTest(cues, 350, 0, PPS)).toBeNull();
    expect(hitTest([], 10, 0, PPS)).toBeNull();
  });

  it("picks the side of a shared boundary the pointer is on", () => {
    expect(hitTest(cues, 198, 0, PPS)).toEqual({ index: 0, mode: "end" });
    expect(hitTest(cues, 202, 0, PPS)).toEqual({ index: 1, mode: "start" });
  });

  it("prefers the selected cue on an exact tie", () => {
    expect(hitTest(cues, 200, 0, PPS, 1)).toEqual({ index: 1, mode: "start" });
    expect(hitTest(cues, 200, 0, PPS, 0)).toEqual({ index: 0, mode: "end" });
  });

  it("keeps a narrow cue's middle grabbable", () => {
    expect(hitTest(cues, 402.5, 0, PPS)).toEqual({ index: 2, mode: "move" });
    expect(hitTest(cues, 400, 0, PPS)).toEqual({ index: 2, mode: "start" });
  });

  it("accounts for scroll", () => {
    expect(hitTest(cues, 0, 1, PPS)).toEqual({ index: 0, mode: "start" });
  });
});

describe("dragCue", () => {
  const prev = { start: 0, end: 1 };
  const origin = { start: 2, end: 3 };
  const next = { start: 4, end: 5 };

  it("moves the start edge", () => {
    expect(dragCue({ mode: "start", origin, prev, next, dt: -0.5 })).toMatchObject({ start: 1.5, end: 3 });
  });

  it("stops the start at the previous cue's end", () => {
    expect(dragCue({ mode: "start", origin, prev, next, dt: -5 })).toMatchObject({ start: 1, end: 3, prevEnd: 1 });
  });

  it("keeps the minimum length", () => {
    expect(dragCue({ mode: "start", origin, dt: 5 }).start).toBeCloseTo(3 - MIN_CUE_LEN);
    expect(dragCue({ mode: "end", origin, dt: -5 }).end).toBeCloseTo(2 + MIN_CUE_LEN);
  });

  it("stops the end at the next cue's start", () => {
    expect(dragCue({ mode: "end", origin, prev, next, dt: 9 })).toMatchObject({ start: 2, end: 4, nextStart: 4 });
  });

  it("never goes below zero", () => {
    expect(dragCue({ mode: "start", origin, dt: -9 }).start).toBe(0);
    expect(dragCue({ mode: "move", origin, dt: -9 })).toMatchObject({ start: 0, end: 1 });
  });

  it("moves the whole cue between its neighbours", () => {
    expect(dragCue({ mode: "move", origin, prev, next, dt: 0.25 })).toMatchObject({ start: 2.25, end: 3.25 });
    expect(dragCue({ mode: "move", origin, prev, next, dt: 9 })).toMatchObject({ start: 3, end: 4 });
    expect(dragCue({ mode: "move", origin, prev, next, dt: -9 })).toMatchObject({ start: 1, end: 2 });
  });

  it("alt-drag moves the neighbour's facing edge and keeps the gap", () => {
    const r = dragCue({ mode: "start", origin, prev, next, dt: -0.5, linked: true });
    expect(r).toMatchObject({ start: 1.5, prevEnd: 0.5 });
    const e = dragCue({ mode: "end", origin, prev, next, dt: 0.5, linked: true });
    expect(e).toMatchObject({ end: 3.5, nextStart: 4.5 });
  });

  it("alt-drag stops when the neighbour hits its minimum length", () => {
    const r = dragCue({ mode: "start", origin, prev, next, dt: -9, linked: true });
    expect(r.prevEnd).toBeCloseTo(prev.start + MIN_CUE_LEN);
    expect(r.start).toBeCloseTo(prev.start + MIN_CUE_LEN + 1);
    const e = dragCue({ mode: "end", origin, prev, next, dt: 9, linked: true });
    expect(e.nextStart).toBeCloseTo(next.end - MIN_CUE_LEN);
  });

  it("restores the neighbour when not linked", () => {
    expect(dragCue({ mode: "start", origin, prev, dt: -0.5 }).prevEnd).toBe(1);
  });

  it("doesn't jump when data already overlaps", () => {
    const overlapping = { start: 0, end: 2.5 };
    expect(dragCue({ mode: "start", origin, prev: overlapping, dt: 0 }).start).toBe(2);
    expect(dragCue({ mode: "move", origin, prev: overlapping, dt: 0 }).start).toBe(2);
  });

  it("rounds to milliseconds", () => {
    expect(dragCue({ mode: "end", origin, dt: 0.12345 }).end).toBe(3.123);
  });
});

describe("cursorFor", () => {
  it("maps hits to cursors", () => {
    expect(cursorFor(null)).toBe("text");
    expect(cursorFor({ index: 0, mode: "start" })).toBe("ew-resize");
    expect(cursorFor({ index: 0, mode: "move" })).toBe("grab");
    expect(cursorFor({ index: 0, mode: "move" }, true)).toBe("grabbing");
  });
});

describe("setEdgeAt", () => {
  const cue = { start: 2, end: 3 };

  it("puts the edge exactly at the click", () => {
    expect(setEdgeAt(cue, "start", 1.2345)).toEqual({ start: 1.235, end: 3 });
    expect(setEdgeAt(cue, "end", 4.5)).toEqual({ start: 2, end: 4.5 });
  });

  it("pushes the other edge only to keep the minimum length", () => {
    expect(setEdgeAt(cue, "start", 3.5)).toEqual({ start: 3.5, end: 3.6 });
    expect(setEdgeAt(cue, "end", 1)).toEqual({ start: 0.9, end: 1 });
  });

  it("never goes below zero", () => {
    expect(setEdgeAt(cue, "start", -1)).toEqual({ start: 0, end: 3 });
    expect(setEdgeAt(cue, "end", 0.02)).toEqual({ start: 0, end: 0.1 });
  });
});
