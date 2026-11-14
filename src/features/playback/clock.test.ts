import { describe, expect, it } from "vitest";
import { applyRate } from "./clock";

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
