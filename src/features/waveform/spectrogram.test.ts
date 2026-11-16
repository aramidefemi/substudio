import { describe, expect, it } from "vitest";
import { binBetween, parseSpectrogram } from "./spectrogram";

function encode(hopsPerSecond: number, nBins: number, values: number[]): ArrayBuffer {
  const hopCount = Math.floor(values.length / nBins);
  const buf = new ArrayBuffer(19 + hopCount * nBins);
  const view = new DataView(buf);
  "SSPC".split("").forEach((c, i) => view.setUint8(i, c.charCodeAt(0)));
  view.setUint8(4, 1);
  view.setFloat64(5, hopsPerSecond, true);
  view.setUint16(13, nBins, true);
  view.setUint32(15, hopCount, true);
  new Uint8Array(buf, 19).set(values.slice(0, hopCount * nBins));
  return buf;
}

describe("parseSpectrogram", () => {
  it("reads the Rust byte format", () => {
    const values = Array.from({ length: 64 }, (_, i) => i);
    const s = parseSpectrogram(encode(50, 64, values))!;
    expect(s.hopsPerSecond).toBe(50);
    expect(s.nBins).toBe(64);
    expect([...s.values]).toEqual(values);
  });

  it("rejects other data", () => {
    expect(parseSpectrogram(new ArrayBuffer(4))).toBeNull();
    const bad = encode(50, 64, Array(64).fill(1));
    new DataView(bad).setUint8(0, 0);
    expect(parseSpectrogram(bad)).toBeNull();
  });
});

describe("binBetween", () => {
  const values = [
    ...Array.from({ length: 64 }, (_, i) => (i === 10 ? 255 : 0)),
    ...Array.from({ length: 64 }, (_, i) => (i === 10 ? 100 : 0)),
  ];
  const s = parseSpectrogram(encode(50, 64, values))!;

  it("returns the loudest hop in the range for a bin", () => {
    expect(binBetween(s, 10, 0, 0.02)).toBe(1);
    expect(binBetween(s, 10, 0.02, 0.04)).toBeCloseTo(100 / 255);
    expect(binBetween(s, 0, 0, 0.04)).toBe(0);
  });
});
