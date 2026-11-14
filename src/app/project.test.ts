import { describe, expect, it } from "vitest";
import type { Cue } from "@/features/subtitles/types";
import { buildProject, matchCueRef, restoreProject } from "./project";

const cues: Cue[] = [
  { id: "a", start: 1, end: 2, text: "One" },
  { id: "b", start: 3, end: 4, text: "Two", bookmark: "check" },
  { id: "c", start: 5.04, end: 6, text: "Three", bookmark: "" },
];

describe("matchCueRef", () => {
  it("uses the index when the start still matches (within ms rounding)", () => {
    expect(matchCueRef(cues, { index: 2, start: 5.0405 })).toBe(2);
  });

  it("falls back to the cue starting at that time when lines moved", () => {
    const shifted = [{ start: 0, end: 0.5, text: "New" }, ...cues];
    expect(matchCueRef(shifted, { index: 1, start: 3 })).toBe(2);
  });

  it("gives up when no cue starts there", () => {
    expect(matchCueRef(cues, { index: 1, start: 3.5 })).toBe(-1);
    expect(matchCueRef([], { index: 0, start: 1 })).toBe(-1);
  });
});

describe("sidecar round trip", () => {
  it("saves bookmarks and selection by index + start and restores them", () => {
    const project = buildProject({ cues, selectedId: "c", videoPath: "/films/a.mp4", fps: 24, timecode: "ms" });
    expect(project).toEqual({
      videoPath: "/films/a.mp4",
      fps: 24,
      timecode: "ms",
      bookmarks: [
        { index: 1, start: 3, note: "check" },
        { index: 2, start: 5.04, note: "" },
      ],
      selected: { index: 2, start: 5.04 },
    });
    const back = restoreProject(cues, project);
    expect([...back.bookmarks]).toEqual([
      [1, "check"],
      [2, ""],
    ]);
    expect(back).toMatchObject({ selectedIndex: 2, fps: 24, timecode: "ms", videoPath: "/films/a.mp4" });
  });

  it("ignores junk values from a hand-edited file", () => {
    const back = restoreProject(cues, {
      videoPath: "",
      fps: -1,
      timecode: "seconds" as never,
      bookmarks: [{ index: 9, start: 99, note: "gone" }],
      selected: null,
    });
    expect(back).toEqual({ bookmarks: new Map(), selectedIndex: -1, fps: null, timecode: null, videoPath: null });
  });
});
