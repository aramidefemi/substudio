import { isBookmarked } from "@/features/subtitles/bookmarks";
import { hasOriginal } from "@/features/subtitles/original";
import type { TimecodeMode } from "@/features/subtitles/timecode";
import type { Cue, CueData } from "@/features/subtitles/types";
import { snapshotOf, type RuleProfile } from "@/features/subtitles/ruleProfiles";
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
  originalPath: string | null;
  fps: number;
  timecode: TimecodeMode;
  /** The active rule profile, saved as a snapshot so the project keeps its rules elsewhere. */
  ruleProfile?: RuleProfile;
  /** 0-based audio stream ordinal (PLY-05); omitted when unknown. */
  audioTrack?: number | null;
  /** Shot-change timestamps (SYN-04); omitted when none. */
  shotChanges?: ArrayLike<number> | null;
}

/** What goes in the sidecar for the current document. */
export function buildProject(s: ProjectSource): ProjectFile {
  const bookmarks = s.cues.flatMap((c, index) =>
    isBookmarked(c) ? [{ index, start: c.start, note: c.bookmark ?? "" }] : [],
  );
  const originals = s.cues.flatMap((c, index) =>
    hasOriginal(c) ? [{ index, start: c.start, text: c.original ?? "" }] : [],
  );
  const machine = s.cues.flatMap((c, index) => (c.mt ? [{ index, start: c.start }] : []));
  const selectedIndex = s.cues.findIndex((c) => c.id === s.selectedId);
  const audioTrack =
    typeof s.audioTrack === "number" && Number.isFinite(s.audioTrack) && s.audioTrack >= 0
      ? Math.trunc(s.audioTrack)
      : null;
  const shotChanges =
    s.shotChanges && s.shotChanges.length > 0 ? Array.from(s.shotChanges) : undefined;
  return {
    videoPath: s.videoPath,
    fps: s.fps,
    timecode: s.timecode,
    bookmarks,
    selected: selectedIndex >= 0 ? { index: selectedIndex, start: s.cues[selectedIndex]!.start } : null,
    originalPath: s.originalPath,
    originals,
    ...(s.ruleProfile ? { ruleProfile: snapshotOf(s.ruleProfile) } : {}),
    audioTrack,
    ...(shotChanges ? { shotChanges } : {}),
    ...(machine.length ? { machine } : {}),
  };
}

export interface RestoredProject {
  bookmarks: Map<number, string>;
  originals: Map<number, string>;
  /** Cue indexes holding an unreviewed machine translation (TRN-01). */
  machine: Set<number>;
  selectedIndex: number;
  fps: number | null;
  timecode: TimecodeMode | null;
  videoPath: string | null;
  originalPath: string | null;
  /** Raw rule profile snapshot; resolve it with `resolveSnapshot`. */
  ruleProfile: unknown;
  audioTrack: number | null;
  /** Shot-change timestamps from the sidecar (SYN-04). */
  shotChanges: number[] | null;
}

/** Turns a sidecar back into document state, matching cue refs against the loaded cues. */
export function restoreProject(cues: readonly CueData[], p: ProjectFile): RestoredProject {
  const bookmarks = new Map<number, string>();
  for (const b of Array.isArray(p.bookmarks) ? p.bookmarks : []) {
    const i = matchCueRef(cues, b);
    if (i >= 0) bookmarks.set(i, typeof b.note === "string" ? b.note : "");
  }
  const originals = new Map<number, string>();
  for (const o of Array.isArray(p.originals) ? p.originals : []) {
    const i = matchCueRef(cues, o);
    if (i >= 0) originals.set(i, typeof o.text === "string" ? o.text : "");
  }
  const machine = new Set<number>();
  for (const m of Array.isArray(p.machine) ? p.machine : []) {
    const i = matchCueRef(cues, m);
    if (i >= 0) machine.add(i);
  }
  return {
    bookmarks,
    originals,
    machine,
    selectedIndex: p.selected ? matchCueRef(cues, p.selected) : -1,
    fps: typeof p.fps === "number" && p.fps > 0 ? p.fps : null,
    timecode: p.timecode === "frames" || p.timecode === "ms" ? p.timecode : null,
    videoPath: typeof p.videoPath === "string" && p.videoPath ? p.videoPath : null,
    originalPath: typeof p.originalPath === "string" && p.originalPath ? p.originalPath : null,
    ruleProfile: p.ruleProfile ?? null,
    audioTrack:
      typeof p.audioTrack === "number" && Number.isFinite(p.audioTrack) && p.audioTrack >= 0
        ? Math.trunc(p.audioTrack)
        : null,
    shotChanges: Array.isArray(p.shotChanges)
      ? p.shotChanges.filter((t): t is number => typeof t === "number" && Number.isFinite(t) && t >= 0)
      : null,
  };
}
