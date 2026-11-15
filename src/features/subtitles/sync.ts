import { MIN_GAP } from "./timing";
import type { CueData } from "./types";

/* ---------- SYN-02: visual / point sync (piecewise linear) ---------- */

/**
 * Pin a cue's start on the subtitle timeline to a video time.
 * `subTime` is the cue's current start; after apply it lands at `videoTime`.
 */
export interface SyncAnchor {
  /** Cue index in the current (sorted) document. */
  index: number;
  /** Subtitle time being pinned (usually `cues[index].start`). */
  subTime: number;
  /** Desired video time for that subtitle moment. */
  videoTime: number;
}

/** Build an anchor from a cue's current start → `videoTime`. */
export function anchorAt(cues: readonly CueData[], index: number, videoTime: number): SyncAnchor | null {
  const cue = cues[index];
  if (!cue || !(videoTime >= 0) || !Number.isFinite(videoTime)) return null;
  return { index, subTime: cue.start, videoTime };
}

/**
 * Sorted unique anchors ready for mapping, or null when fewer than two usable
 * points remain (duplicate cue indices collapse to the last one).
 */
export function normalizeAnchors(anchors: readonly SyncAnchor[]): SyncAnchor[] | null {
  if (anchors.length < 2) return null;
  // Last write wins per cue index so re-setting a point replaces it.
  const byIndex = new Map<number, SyncAnchor>();
  for (const a of anchors) {
    if (a.index < 0 || !Number.isFinite(a.subTime) || !Number.isFinite(a.videoTime) || a.videoTime < 0) continue;
    byIndex.set(a.index, a);
  }
  const sorted = [...byIndex.values()].sort((a, b) => a.subTime - b.subTime || a.index - b.index);
  if (sorted.length < 2) return null;
  // Distinct subtitle times required for a defined slope.
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.subTime <= sorted[i - 1]!.subTime) return null;
  }
  return sorted;
}

/** True when video times rise with subtitle times (no time reversal). */
export function anchorsMonotonic(anchors: readonly SyncAnchor[]): boolean {
  const pts = normalizeAnchors(anchors);
  if (!pts) return false;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i]!.videoTime <= pts[i - 1]!.videoTime) return false;
  }
  return true;
}

/**
 * Piecewise-linear map subtitle time → video time.
 * Outside the first/last segment, extrapolates with the nearest segment's slope.
 * `anchors` must already be normalized (≥2, ascending subTime).
 */
export function mapThroughAnchors(t: number, anchors: readonly SyncAnchor[]): number {
  const n = anchors.length;
  if (n < 2) return t;
  // Before first / after last: use nearest segment.
  let i = 0;
  if (t <= anchors[0]!.subTime) i = 0;
  else if (t >= anchors[n - 1]!.subTime) i = n - 2;
  else {
    while (i < n - 2 && t > anchors[i + 1]!.subTime) i++;
  }
  const a = anchors[i]!;
  const b = anchors[i + 1]!;
  const span = b.subTime - a.subTime;
  const u = span === 0 ? 0 : (t - a.subTime) / span;
  return a.videoTime + u * (b.videoTime - a.videoTime);
}

/** Clamp a remapped cue so start ≥ 0 and end ≥ start + MIN_GAP. */
export function clampedMapped(start: number, end: number): { start: number; end: number } {
  const s = Math.max(0, start);
  return { start: s, end: Math.max(s + MIN_GAP, end) };
}

/**
 * Remap every cue through the anchors. Returns null when anchors are invalid.
 * Durations scale with the local slope (start and end mapped independently).
 */
export function remapCues(cues: readonly CueData[], anchors: readonly SyncAnchor[]): CueData[] | null {
  const pts = normalizeAnchors(anchors);
  if (!pts || !anchorsMonotonic(anchors)) return null;
  return cues.map((c) => {
    const { start, end } = clampedMapped(mapThroughAnchors(c.start, pts), mapThroughAnchors(c.end, pts));
    return { ...c, start, end };
  });
}

/** How many cues change start or end after remapping. */
export function countRemapped(before: readonly CueData[], after: readonly CueData[]): number {
  let n = 0;
  for (let i = 0; i < before.length; i++) {
    const a = before[i]!;
    const b = after[i]!;
    if (a.start !== b.start || a.end !== b.end) n++;
  }
  return n;
}
