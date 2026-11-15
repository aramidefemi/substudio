import { snapAllToSourceFrames } from "@/features/media/frameTimes";
import { DEFAULT_RULES } from "./rules";
import { MIN_GAP } from "./timing";
import type { CueData } from "./types";

export interface BeautifyOptions {
  snapToFrames: boolean;
  fps: number;
  /** Source frame timestamps when available (MED-03); CFR fps used otherwise. */
  frameTimes?: ArrayLike<number> | null;
  applyMinGap: boolean;
  minGap: number;
  /** Bridge gaps shorter than this (seconds). `0` / null = off. */
  bridgeGapsUnder: number | null;
  applyDurationLimits: boolean;
  minDuration: number;
  maxDuration: number;
}

export const DEFAULT_BEAUTIFY: BeautifyOptions = {
  snapToFrames: true,
  fps: 25,
  applyMinGap: true,
  minGap: MIN_GAP,
  bridgeGapsUnder: 0.5,
  applyDurationLimits: false,
  minDuration: DEFAULT_RULES.minDuration,
  maxDuration: DEFAULT_RULES.maxDuration,
};

function clone(cues: readonly CueData[]): CueData[] {
  return cues.map((c) => ({ ...c }));
}

/** Push overlapping / too-close neighbours apart (keeps durations). */
function enforceMinGap(cues: CueData[], minGap: number): void {
  for (let i = 1; i < cues.length; i++) {
    const prev = cues[i - 1]!;
    const cur = cues[i]!;
    const need = prev.end + minGap;
    if (cur.start >= need) continue;
    const dur = Math.max(minGap, cur.end - cur.start);
    cur.start = need;
    cur.end = cur.start + dur;
  }
}

/** Extend previous end into a short gap (SE Bridge gaps). */
function bridgeGaps(cues: CueData[], under: number, minGap: number): void {
  for (let i = 1; i < cues.length; i++) {
    const prev = cues[i - 1]!;
    const cur = cues[i]!;
    const gap = cur.start - prev.end;
    if (gap <= 0 || gap >= under) continue;
    prev.end = Math.max(prev.start + minGap, cur.start - minGap);
  }
}

function clampDurations(cues: CueData[], minD: number, maxD: number, minGap: number): void {
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i]!;
    const next = cues[i + 1];
    let dur = c.end - c.start;
    if (dur < minD) dur = minD;
    if (dur > maxD) dur = maxD;
    let end = c.start + dur;
    if (next) end = Math.min(end, next.start - minGap);
    c.end = Math.max(c.start + minGap, end);
  }
}

/** Beautify / bridge / duration polish (QLT-02). Pure. */
export function beautifyCues(cues: readonly CueData[], opts: BeautifyOptions): CueData[] {
  const out = clone(cues);
  if (!out.length) return out;

  const doSnap = opts.snapToFrames && (opts.fps > 0 || (opts.frameTimes && opts.frameTimes.length > 0));
  if (doSnap) snapAllToSourceFrames(out, opts.frameTimes, opts.fps);
  if (opts.bridgeGapsUnder && opts.bridgeGapsUnder > 0) {
    bridgeGaps(out, opts.bridgeGapsUnder, opts.minGap);
  }
  if (opts.applyMinGap) enforceMinGap(out, opts.minGap);
  if (opts.applyDurationLimits) {
    clampDurations(out, opts.minDuration, opts.maxDuration, opts.minGap);
    if (opts.applyMinGap) enforceMinGap(out, opts.minGap);
  }
  if (doSnap) snapAllToSourceFrames(out, opts.frameTimes, opts.fps);
  return out;
}

export function countBeautifyChanges(before: readonly CueData[], after: readonly CueData[]): number {
  const n = Math.min(before.length, after.length);
  let changed = 0;
  for (let i = 0; i < n; i++) {
    const a = before[i]!;
    const b = after[i]!;
    if (Math.abs(a.start - b.start) > 1e-4 || Math.abs(a.end - b.end) > 1e-4 || a.text !== b.text) {
      changed += 1;
    }
  }
  return changed + Math.abs(before.length - after.length);
}
