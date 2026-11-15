import { describe, expect, it } from "vitest";
import type { MediaTrack } from "@/lib/tauri";
import {
  audioTrackLabel,
  clampAudioOrdinal,
  cycleAudioOrdinal,
  listAudioTracks,
  resolveAudioTrack,
} from "./audioTracks";

const tracks: MediaTrack[] = [
  { index: 0, kind: "video", codec: "h264", language: null, detail: "1920×1080" },
  { index: 1, kind: "audio", codec: "aac", language: "eng", detail: "2 ch, 48000 Hz" },
  { index: 2, kind: "audio", codec: "aac", language: "yor", detail: "2 ch, 48000 Hz" },
  { index: 3, kind: "subtitle", codec: "mov_text", language: "eng", detail: null },
];

describe("listAudioTracks", () => {
  it("keeps only audio streams in order", () => {
    expect(listAudioTracks(tracks).map((t) => t.index)).toEqual([1, 2]);
  });
});

describe("audioTrackLabel", () => {
  it("includes ordinal, language, codec and detail", () => {
    expect(audioTrackLabel(tracks[1]!, 0)).toBe("Track 1 · eng · aac · 2 ch, 48000 Hz");
    expect(audioTrackLabel({ index: 5, kind: "audio", codec: null, language: null, detail: null }, 3)).toBe(
      "Track 4",
    );
  });
});

describe("clampAudioOrdinal / cycle / resolve", () => {
  it("clamps into range and defaults empty lists to 0", () => {
    expect(clampAudioOrdinal(2, 1)).toBe(1);
    expect(clampAudioOrdinal(2, 9)).toBe(1);
    expect(clampAudioOrdinal(2, -1)).toBe(0);
    expect(clampAudioOrdinal(2, null)).toBe(0);
    expect(clampAudioOrdinal(0, 3)).toBe(0);
  });

  it("cycles with wrap", () => {
    expect(cycleAudioOrdinal(2, 0, 1)).toBe(1);
    expect(cycleAudioOrdinal(2, 1, 1)).toBe(0);
    expect(cycleAudioOrdinal(2, 0, -1)).toBe(1);
    expect(cycleAudioOrdinal(1, 0, 1)).toBe(0);
  });

  it("resolves against probe tracks", () => {
    expect(resolveAudioTrack(tracks, 1)).toBe(1);
    expect(resolveAudioTrack(tracks, 99)).toBe(1);
    expect(resolveAudioTrack([], 2)).toBe(0);
  });
});
