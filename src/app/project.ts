import { isBookmarked } from "@/features/subtitles/bookmarks";
import type { TimecodeMode } from "@/features/subtitles/timecode";
import type { Cue, CueData } from "@/features/subtitles/types";
import type { ProjectFile } from "@/lib/tauri";

/** SRT stores milliseconds, so a cue's start can drift by rounding; a frame at 60 fps is ~17 ms. */
const START_TOLERANCE = 0.005;

interface CueRef {
  index: number;
  start: number;
}

/**
 * Finds the cue a saved reference meant: the same index when its start still
 * matches, otherwise the cue that starts at that time (lines were added or
 * removed outside the app). −1 when nothing matches.
 */
export function matchCueRef(cues: readonly CueData[], ref: CueRef): number {
  const same = cues[ref.index];
  if (same && Math.abs(same.start - ref.start) <= START_TOLERANCE) return ref.index;
  let best = -1;
  let bestDelta = START_TOLERANCE;
  cues.forEach((c, i) => {
    const d = Math.abs(c.start - ref.start);
    if (d <= bestDelta) {
      best = i;
      bestDelta = d;
    }
  });
  return best;
}

export interface ProjectSource {
  cues: readonly Cue[];
  selectedId: string | null;
  videoPath: string | null;
  fps: number;
  timecode: TimecodeMode;
}

/** What goes in the sidecar for the current document. */
export function buildProject(s: ProjectSource): ProjectFile {
  const bookmarks = s.cues.flatMap((c, index) =>
    isBookmarked(c) ? [{ index, start: c.start, note: c.bookmark ?? "" }] : [],
  );
  const selectedIndex = s.cues.findIndex((c) => c.id === s.selectedId);
  return {
    videoPath: s.videoPath,
    fps: s.fps,
    timecode: s.timecode,
    bookmarks,
    selected: selectedIndex >= 0 ? { index: selectedIndex, start: s.cues[selectedIndex]!.start } : null,
  };
}

export interface RestoredProject {
  bookmarks: Map<number, string>;
  selectedIndex: number;
  fps: number | null;
  timecode: TimecodeMode | null;
  videoPath: string | null;
}

/** Turns a sidecar back into document state, matching cue refs against the loaded cues. */
export function restoreProject(cues: readonly CueData[], p: ProjectFile): RestoredProject {
  const bookmarks = new Map<number, string>();
  for (const b of Array.isArray(p.bookmarks) ? p.bookmarks : []) {
    const i = matchCueRef(cues, b);
    if (i >= 0) bookmarks.set(i, typeof b.note === "string" ? b.note : "");
  }
  return {
    bookmarks,
    selectedIndex: p.selected ? matchCueRef(cues, p.selected) : -1,
    fps: typeof p.fps === "number" && p.fps > 0 ? p.fps : null,
    timecode: p.timecode === "frames" || p.timecode === "ms" ? p.timecode : null,
    videoPath: typeof p.videoPath === "string" && p.videoPath ? p.videoPath : null,
  };
}
