import { describe, expect, it } from "vitest";
import {
  nearestShot,
  nextShot,
  normalizeShotList,
  parseShotChanges,
  previousShot,
  snapCueToShots,
  toggleShotAt,
} from "./shotChanges";

function encode(times: number[]): ArrayBuffer {
  const buf = new ArrayBuffer(9 + times.length * 8);
  const view = new DataView(buf);
  view.setUint8(0, "S".charCodeAt(0));
  view.setUint8(1, "S".charCodeAt(0));
  view.setUint8(2, "S".charCodeAt(0));
  view.setUint8(3, "C".charCodeAt(0));
  view.setUint8(4, 1);
  view.setUint32(5, times.length, true);
  times.forEach((t, i) => view.setFloat64(9 + i * 8, t, true));
  return buf;
}

const shots = [1, 5, 10, 20];

describe("parseShotChanges", () => {
  it("round-trips SSSC bytes", () => {
    expect([...parseShotChanges(encode([0, 1.5, 12.25]))]).toEqual([0, 1.5, 12.25]);
  });
});

describe("navigate", () => {
  it("finds previous and next", () => {
    expect(previousShot(shots, 5)).toBe(1);
    expect(previousShot(shots, 5.001)).toBe(5);
    expect(previousShot(shots, 0.5)).toBeNull();
    expect(nextShot(shots, 5)).toBe(10);
    expect(nextShot(shots, 20)).toBeNull();
  });

  it("finds nearest within distance", () => {
    expect(nearestShot(shots, 5.2, 0.5)).toBe(5);
    expect(nearestShot(shots, 7, 0.5)).toBeNull();
    expect(nearestShot(shots, 7, 3)).toBe(5);
  });
});

describe("snapCueToShots", () => {
  it("snaps both edges", () => {
    const cue = { start: 4.9, end: 10.2 };
    snapCueToShots(cue, shots, 0.5);
    expect(cue.start).toBe(5);
    expect(cue.end).toBe(10);
  });
});

describe("normalizeShotList", () => {
  it("filters and sorts", () => {
    expect([...normalizeShotList([10, 1, NaN, -1, 1.00005])!]).toEqual([1, 10]);
    expect(normalizeShotList([])).toBeNull();
  });
});

describe("toggleShotAt", () => {
  it("inserts when nothing is nearby", () => {
    const { next, added } = toggleShotAt([1, 10], 5, 0.08);
    expect(added).toBe(true);
    expect([...next!]).toEqual([1, 5, 10]);
  });

  it("removes the nearest shot within eps", () => {
    const { next, added } = toggleShotAt([1, 5, 10], 5.04, 0.08);
    expect(added).toBe(false);
    expect([...next!]).toEqual([1, 10]);
  });

  it("clears to null when removing the last shot", () => {
    expect(toggleShotAt([2], 2, 0.08)).toEqual({ next: null, added: false });
  });
});
