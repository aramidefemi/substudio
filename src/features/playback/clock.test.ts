import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyRate, PlaybackClock } from "./clock";

describe("applyRate", () => {
  it("keeps pitch (standard and WebKit flags) when changing speed", () => {
    const video = { preservesPitch: false, playbackRate: 1 } as HTMLVideoElement & { webkitPreservesPitch?: boolean };
    applyRate(video, 1.5);
    expect(video.playbackRate).toBe(1.5);
    expect(video.defaultPlaybackRate).toBe(1.5);
    expect(video.preservesPitch).toBe(true);
    expect(video.webkitPreservesPitch).toBe(true);
  });
});

/** Drives the simulated clock (no video) with fake animation frames. */
describe("PlaybackClock play ranges (simulated)", () => {
  let frames: FrameRequestCallback[] = [];
  let now = 0;
  const advance = (ms: number, step = 50) => {
    for (let t = 0; t < ms; t += step) {
      now += step;
      const due = frames;
      frames = [];
      due.forEach((cb) => cb(now));
    }
  };

  beforeEach(() => {
    frames = [];
    now = 1000;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => (frames = []));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("plays a range once and stops at its end", () => {
    const clock = new PlaybackClock();
    clock.playRange(2, 3);
    expect(clock.time).toBe(2);
    expect(clock.playing).toBe(true);
    advance(500);
    expect(clock.time).toBeGreaterThan(2.3);
    expect(clock.playing).toBe(true);
    advance(1000);
    expect(clock.playing).toBe(false);
    expect(clock.time).toBe(3);
    expect(clock.range).toBeNull();
  });

  it("loops a range until paused", () => {
    const clock = new PlaybackClock();
    clock.playRange(5, 6, true);
    expect(clock.looping).toBe(true);
    advance(2600);
    expect(clock.playing).toBe(true);
    expect(clock.time).toBeGreaterThanOrEqual(5);
    expect(clock.time).toBeLessThan(6);
    clock.pause();
    expect(clock.looping).toBe(false);
    expect(clock.playing).toBe(false);
  });

  it("drops the range on a manual seek or plain play", () => {
    const clock = new PlaybackClock();
    clock.playRange(1, 2, true);
    clock.seek(4);
    expect(clock.range).toBeNull();
    expect(clock.playing).toBe(true);
    clock.playRange(1, 2);
    clock.play();
    expect(clock.range).toBeNull();
    advance(1500);
    expect(clock.time).toBeGreaterThan(2);
    expect(clock.playing).toBe(true);
  });

  it("plays from a pre-roll point, clamped at zero", () => {
    const clock = new PlaybackClock();
    clock.playFrom(-0.5);
    expect(clock.time).toBe(0);
    expect(clock.playing).toBe(true);
  });

  it("ignores empty ranges", () => {
    const clock = new PlaybackClock();
    clock.playRange(3, 3);
    expect(clock.playing).toBe(false);
  });

  it("respects the playback rate inside a range", () => {
    const clock = new PlaybackClock();
    clock.setRate(0.5);
    clock.playRange(0, 1);
    advance(1500);
    expect(clock.playing).toBe(true);
    advance(700);
    expect(clock.playing).toBe(false);
  });
});
