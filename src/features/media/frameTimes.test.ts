import { describe, expect, it } from "vitest";
import {
  frameIndexAt,
  parseFrameTimes,
  snapAllToSourceFrames,
  snapToNearestFrame,
  stepAlongFrames,
} from "./frameTimes";

function encode(times: number[]): ArrayBuffer {
  const buf = new ArrayBuffer(9 + times.length * 8);
  const view = new DataView(buf);
  view.setUint8(0, "S".charCodeAt(0));
  view.setUint8(1, "S".charCodeAt(0));
  view.setUint8(2, "F".charCodeAt(0));
  view.setUint8(3, "T".charCodeAt(0));
  view.setUint8(4, 1);
  view.setUint32(5, times.length, true);
  times.forEach((t, i) => view.setFloat64(9 + i * 8, t, true));
  return buf;
}

describe("parseFrameTimes", () => {
  it("round-trips SSFT bytes", () => {
    const times = [0, 0.04, 0.08, 1.5];
    expect([...parseFrameTimes(encode(times))]).toEqual(times);
  });
});

describe("stepAlongFrames", () => {
  const times = Float64Array.from([0, 0.04, 0.1, 0.12, 0.2]); // irregular / VFR-ish

  it("steps on real timestamps", () => {
    expect(stepAlongFrames(0, 1, times, 25)).toBeCloseTo(0.04);
    expect(stepAlongFrames(0.04, 1, times, 25)).toBeCloseTo(0.1);
    expect(stepAlongFrames(0.1, -1, times, 25)).toBeCloseTo(0.04);
  });

  it("from mid-frame backs to the current frame first", () => {
    expect(stepAlongFrames(0.06, -1, times, 25)).toBeCloseTo(0.04);
    expect(stepAlongFrames(0.06, 1, times, 25)).toBeCloseTo(0.1);
  });

  it("falls back to fps when timestamps are missing", () => {
    expect(stepAlongFrames(1, 1, null, 25)).toBeCloseTo(1.04);
    expect(stepAlongFrames(1.01, -1, undefined, 25)).toBeCloseTo(1);
  });
});

describe("frameIndexAt", () => {
  it("finds the frame at or before t", () => {
    const times = [0, 0.04, 0.08];
    expect(frameIndexAt(times, 0)).toBe(0);
    expect(frameIndexAt(times, 0.04)).toBe(1);
    expect(frameIndexAt(times, 0.05)).toBe(1);
    expect(frameIndexAt(times, 1)).toBe(2);
  });
});

describe("snapToNearestFrame", () => {
  const vfr = [0, 0.04, 0.1, 0.12, 0.2]; // irregular — not a 25fps grid

  it("snaps off-grid times to nearest source frame", () => {
    expect(snapToNearestFrame(0.03, vfr, 25)).toBeCloseTo(0.04);
    expect(snapToNearestFrame(0.11, vfr, 25)).toBeCloseTo(0.1);
    expect(snapToNearestFrame(0.19, vfr, 25)).toBeCloseTo(0.2);
  });

  it("on a midway tie prefers the earlier frame", () => {
    // midway between 0.04 and 0.1 → 0.07; equal distance → earlier
    expect(snapToNearestFrame(0.07, vfr, 25)).toBeCloseTo(0.04);
  });

  it("falls back to fps when times are null or empty", () => {
    expect(snapToNearestFrame(0.03, null, 25)).toBeCloseTo(0.04);
    expect(snapToNearestFrame(1.02, [], 25)).toBeCloseTo(1.04);
    expect(snapToNearestFrame(1.5, undefined, 0)).toBe(1.5);
  });
});

describe("snapAllToSourceFrames", () => {
  const vfr = [0, 0.04, 0.1, 0.12, 0.2];

  it("keeps end > start on VFR when both snap to the same frame", () => {
    const cues = [{ start: 0.09, end: 0.105, text: "" }];
    snapAllToSourceFrames(cues, vfr, 25);
    expect(cues[0]!.start).toBeCloseTo(0.1);
    expect(cues[0]!.end).toBeCloseTo(0.12);
    expect(cues[0]!.end).toBeGreaterThan(cues[0]!.start);
  });

  it("falls back to CFR when times missing", () => {
    const cues = [{ start: 0.03, end: 1.07, text: "" }];
    snapAllToSourceFrames(cues, null, 25);
    expect(cues[0]!.start).toBeCloseTo(0.04);
    expect(cues[0]!.end).toBeCloseTo(1.08);
  });
});
