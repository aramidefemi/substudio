import { describe, expect, it } from "vitest";
import type { Peaks } from "./peaks";
import { guessCueTimes, seekSilence, silentRuns } from "./silence";

const RATE = 100;

/** Build peaks from [seconds, level 0–255] segments. */
function peaks(...segments: [number, number][]): Peaks {
  const out: number[] = [];
  for (const [secs, level] of segments) for (let i = 0; i < Math.round(secs * RATE); i++) out.push(level);
  return { rate: RATE, values: Uint8Array.from(out) };
}

// 1 s silence · 2 s speech · 0.5 s pause · 1.5 s speech · 0.1 s blip-gap · 1 s speech · 2 s silence
const dialogue = peaks([1, 2], [2, 200], [0.5, 5], [1.5, 180], [0.1, 3], [1, 190], [2, 1]);

describe("silentRuns", () => {
  it("finds pauses of at least 200 ms", () => {
    const runs = silentRuns(dialogue, 0, 10);
    expect(runs.map((r) => [r.start, r.end])).toEqual([
      [0, 1],
      [3, 3.5],
      [6.1, 8.1],
    ]);
  });

  it("ignores pauses shorter than the minimum", () => {
    expect(silentRuns(dialogue, 4.5, 5.5)).toEqual([]);
  });

  it("is relative to local loudness", () => {
    // A quiet scene: speech at 40, room tone at 4. Absolute 15% of full scale would call it all silence.
    const quiet = peaks([1, 40], [0.5, 4], [1, 40]);
    expect(silentRuns(quiet, 0, 2.5).map((r) => [r.start, r.end])).toEqual([[1, 1.5]]);
    // Loud music bed under speech: no silence even though levels dip.
    const music = peaks([1, 220], [0.5, 120], [1, 220]);
    expect(silentRuns(music, 0, 2.5)).toEqual([]);
  });

  it("handles an empty range", () => {
    expect(silentRuns(dialogue, 5, 5)).toEqual([]);
    expect(silentRuns(dialogue, 50, 60)).toEqual([]);
  });
});

describe("seekSilence", () => {
  it("goes forward to the start of the next silence", () => {
    expect(seekSilence(dialogue, 1.5, 1)).toBe(3);
    expect(seekSilence(dialogue, 3, 1)).toBe(6.1);
    expect(seekSilence(dialogue, 7, 1)).toBeNull();
  });

  it("goes back to the start of the previous silence", () => {
    expect(seekSilence(dialogue, 5, -1)).toBe(3);
    expect(seekSilence(dialogue, 3, -1)).toBe(0);
    expect(seekSilence(dialogue, 0, -1)).toBeNull();
  });
});

describe("guessCueTimes", () => {
  it("snaps a rough cue to where speech starts and stops", () => {
    expect(guessCueTimes(dialogue, { start: 0.8, end: 3.3 })).toEqual({ start: 1, end: 3 });
    expect(guessCueTimes(dialogue, { start: 3.7, end: 6.4 })).toEqual({ start: 3.5, end: 6.1 });
  });

  it("returns null for an edge with no change nearby", () => {
    const long = peaks([5, 200]);
    expect(guessCueTimes(long, { start: 2, end: 3 })).toEqual({ start: null, end: null });
  });

  it("treats loud audio at 0 s as an onset", () => {
    const loud = peaks([1, 200], [1, 2]);
    expect(guessCueTimes(loud, { start: 0.3, end: 1.2 })).toEqual({ start: 0, end: 1 });
  });
});
