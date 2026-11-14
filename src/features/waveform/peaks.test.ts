import { describe, expect, it } from "vitest";
import { parsePeaks, peakBetween } from "./peaks";

/** Same layout as `Peaks::to_bytes` in `src-tauri/src/waveform.rs`. */
function encode(rate: number, values: number[]): ArrayBuffer {
  const buf = new ArrayBuffer(17 + values.length);
  const view = new DataView(buf);
  "SSPK".split("").forEach((c, i) => view.setUint8(i, c.charCodeAt(0)));
  view.setUint8(4, 1);
  view.setFloat64(5, rate, true);
  view.setUint32(13, values.length, true);
  new Uint8Array(buf, 17).set(values);
  return buf;
}

describe("parsePeaks", () => {
  it("reads the Rust byte format", () => {
    const p = parsePeaks(encode(100, [0, 128, 255]))!;
    expect(p.rate).toBe(100);
    expect([...p.values]).toEqual([0, 128, 255]);
  });

  it("rejects other data", () => {
    expect(parsePeaks(new ArrayBuffer(4))).toBeNull();
    const bad = encode(100, [1]);
    new DataView(bad).setUint8(0, 0);
    expect(parsePeaks(bad)).toBeNull();
  });
});

describe("peakBetween", () => {
  const p = parsePeaks(encode(100, [10, 255, 20, 0]))!;

  it("returns the loudest bucket in the range", () => {
    expect(peakBetween(p, 0, 0.04)).toBe(1);
    expect(peakBetween(p, 0.02, 0.04)).toBeCloseTo(20 / 255);
  });

  it("always samples at least one bucket and clamps past the end", () => {
    expect(peakBetween(p, 0.031, 0.031)).toBe(0);
    expect(peakBetween(p, 10, 11)).toBe(0);
  });
});
