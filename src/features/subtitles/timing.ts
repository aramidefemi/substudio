import type { CueData } from "./types";

/** Minimum gap between cues (matches insertCue). */
export const MIN_GAP = 0.04;

/** Default length when first timing an untimed script line (SCR-02). */
export const DEFAULT_DURATION = 2;

/** Default ±ms nudge (Subtitle Edit's 100 ms). */
export const MS_STEP = 0.1;

/** Default custom step (Subtitle Edit's configurable X ms; 25 ms). */
export const CUSTOM_STEP = 0.025;

/**
 * First real start/end for an untimed cue when one edge is set at `t`
 * (playhead or waveform click). Pure — call sites clear `untimed` and sort.
 */
export function timesForUntimed(
  t: number,
  edge: "start" | "end",
  duration = DEFAULT_DURATION,
): { start: number; end: number } {
  if (edge === "start") {
    const start = Math.max(0, t);
    return { start, end: start + duration };
  }
  const end = Math.max(MIN_GAP, t);
  return { start: Math.max(0, end - duration), end };
}

export type Edge = "start" | "end";
/** plain = free move; keepGap = move neighbour edge with us; push = shove neighbours out of overlaps. */
export type NudgeMode = "plain" | "keepGap" | "push";

export const frameStep = (fps: number) => 1 / fps;

export const snapToFrame = (t: number, fps: number) => Math.max(0, Math.round(t * fps) / fps);

/** Shortest cue hold-to-time makes (a tap, or a hold while paused). */
export const MIN_HELD_DURATION = 0.3;

/**
 * Provisional length of a held cue until the key is released. It is also the
 * final length when the command runs from the menu or palette (no release).
 */
export const HELD_PROVISIONAL = 2;

/**
 * Where hold-to-time puts a cue pressed at `t` (TIM-01): sorted position,
 * start at `t` (or just after a cue still on screen), and a provisional end
 * (shortened to fit before the next cue) until the key is released.
 */
export function placeHeldCue(
  cues: readonly CueData[],
  t: number,
  minGap = MIN_GAP,
): { index: number; start: number; end: number } {
  let index = cues.findIndex((c) => c.start > t);
  if (index === -1) index = cues.length;
  const prev = cues[index - 1];
  const next = cues[index];
  const start = prev && t < prev.end + minGap ? prev.end + minGap : Math.max(0, t);
  const limit = next ? next.start - minGap : Infinity;
  return { index, start, end: Math.max(start + minGap, Math.min(start + HELD_PROVISIONAL, limit)) };
}

/** End for a held cue released at `t`: at least MIN_HELD_DURATION, never into the next cue. */
export function heldCueEnd(cues: readonly CueData[], index: number, t: number, minGap = MIN_GAP): number {
  const cue = cues[index]!;
  const next = cues[index + 1];
  let end = Math.max(t, cue.start + MIN_HELD_DURATION);
  if (next) end = Math.min(end, next.start - minGap);
  return Math.max(end, cue.start + minGap);
}

/** Tolerance (in frames) for treating a time as sitting on a frame boundary. */
const FRAME_EPS = 1e-3;

/**
 * Playhead time `frames` frames away from `t`, landing on a frame boundary at
 * the project fps. Off-grid times step to the next/previous boundary first, so
 * one step back from mid-frame lands on the start of the current frame.
 * Project fps for now; switch to the source's real frame timestamps with the
 * media layer (MED) for variable frame rate.
 */
export function stepFrames(t: number, fps: number, frames: number): number {
  if (!frames || fps <= 0) return t;
  const f = t * fps;
  const base = frames > 0 ? Math.floor(f + FRAME_EPS) : Math.ceil(f - FRAME_EPS);
  return Math.max(0, (base + frames) / fps);
}

const dur = (c: CueData) => c.end - c.start;

const shiftCue = (c: CueData, delta: number) => {
  c.start = Math.max(0, c.start + delta);
  c.end = Math.max(c.start + MIN_GAP, c.end + delta);
};

/** Nudge one cue's start or end. Mutates in place (Immer draft-safe). */
export function nudgeEdge(
  cues: CueData[],
  index: number,
  edge: Edge,
  delta: number,
  mode: NudgeMode,
  minGap = MIN_GAP,
): void {
  const c = cues[index];
  if (!c || !delta) return;

  if (edge === "start") {
    const nextStart = Math.max(0, c.start + delta);
    if (mode === "keepGap") {
      const prev = cues[index - 1];
      if (prev) {
        prev.end += nextStart - c.start;
        if (prev.end < prev.start + minGap) prev.end = prev.start + minGap;
      }
    }
    c.start = nextStart;
    if (c.end < c.start + minGap) c.end = c.start + minGap;
    if (mode === "push") resolveOverlaps(cues, index, minGap);
    return;
  }

  const nextEnd = Math.max(c.start + minGap, c.end + delta);
  if (mode === "keepGap") {
    const next = cues[index + 1];
    if (next) {
      const d = nextEnd - c.end;
      next.start += d;
      next.end += d;
    }
  }
  c.end = nextEnd;
  if (mode === "push") resolveOverlaps(cues, index, minGap);
}

/** Shift selected cue indices (and optionally everything after the earliest). */
export function shiftIndices(
  cues: CueData[],
  indices: readonly number[],
  delta: number,
  withFollowing: boolean,
): void {
  if (!indices.length || !delta) return;
  if (withFollowing) {
    const from = Math.min(...indices);
    for (let i = from; i < cues.length; i++) shiftCue(cues[i]!, delta);
    return;
  }
  for (const i of indices) {
    const c = cues[i];
    if (c) shiftCue(c, delta);
  }
}

export function shiftAll(cues: CueData[], delta: number): void {
  if (!delta) return;
  for (const c of cues) shiftCue(c, delta);
}

export interface SetStartOpts {
  keepDuration?: boolean;
  /** Shift this cue and every following cue by the same delta. */
  offsetRest?: boolean;
}

/** Set start at `t` (seconds). */
export function setStartAt(cues: CueData[], index: number, t: number, opts: SetStartOpts = {}): void {
  const c = cues[index];
  if (!c) return;
  const target = Math.max(0, t);
  if (opts.offsetRest) {
    shiftIndices(cues, [index], target - c.start, true);
    return;
  }
  if (opts.keepDuration) {
    const d = dur(c);
    c.start = target;
    c.end = target + d;
    return;
  }
  c.start = Math.min(target, c.end - MIN_GAP);
  if (c.start < 0) c.start = 0;
}

/** Set end at `t` (seconds). */
export function setEndAt(cues: CueData[], index: number, t: number): void {
  const c = cues[index];
  if (!c) return;
  c.end = Math.max(c.start + MIN_GAP, t);
}

/**
 * Set end at `t`, then place the next cue's start at end + minGap (keeps next duration).
 * Returns false if there is no next cue.
 */
export function setEndAndStartOfNext(cues: CueData[], index: number, t: number, minGap = MIN_GAP): boolean {
  const c = cues[index];
  const next = cues[index + 1];
  if (!c || !next) return false;
  setEndAt(cues, index, t);
  const d = dur(next);
  next.start = c.end + minGap;
  next.end = next.start + d;
  return true;
}

/**
 * Set start at `t`, then set previous end to start − minGap.
 * Returns false if there is no previous cue.
 */
export function setStartAndEndOfPrevious(cues: CueData[], index: number, t: number, minGap = MIN_GAP): boolean {
  const c = cues[index];
  const prev = cues[index - 1];
  if (!c || !prev) return false;
  setStartAt(cues, index, t);
  prev.end = Math.max(prev.start + MIN_GAP, c.start - minGap);
  return true;
}

/** Extend selected start to previous end + gap (or 0). Shot-change extend is not implemented. */
export function extendToPrevious(cues: CueData[], index: number, minGap = MIN_GAP): void {
  const c = cues[index];
  if (!c) return;
  const prev = cues[index - 1];
  c.start = prev ? prev.end + minGap : 0;
  if (c.end < c.start + MIN_GAP) c.end = c.start + MIN_GAP;
}

export function extendToNext(cues: CueData[], index: number, minGap = MIN_GAP): void {
  const c = cues[index];
  if (!c) return;
  const next = cues[index + 1];
  if (!next) return;
  c.end = Math.max(c.start + MIN_GAP, next.start - minGap);
}

export function extendPreviousEndToSelected(cues: CueData[], index: number, minGap = MIN_GAP): void {
  const c = cues[index];
  const prev = cues[index - 1];
  if (!c || !prev) return;
  prev.end = Math.max(prev.start + MIN_GAP, c.start - minGap);
}

export function extendNextStartToSelected(cues: CueData[], index: number, minGap = MIN_GAP): void {
  const c = cues[index];
  const next = cues[index + 1];
  if (!c || !next) return;
  const d = dur(next);
  next.start = c.end + minGap;
  next.end = next.start + d;
}

export function snapAllToFrames(cues: CueData[], fps: number): void {
  const step = frameStep(fps);
  for (const c of cues) {
    c.start = snapToFrame(c.start, fps);
    c.end = snapToFrame(c.end, fps);
    if (c.end <= c.start) c.end = c.start + step;
  }
}

/** After a nudge/push, shove neighbours so minGap is respected (cascade). */
function resolveOverlaps(cues: CueData[], index: number, minGap: number): void {
  for (let i = index; i > 0; i--) {
    const cur = cues[i]!;
    const prev = cues[i - 1]!;
    if (cur.start >= prev.end + minGap) break;
    const overflow = prev.end + minGap - cur.start;
    shiftCue(prev, -overflow);
  }
  for (let i = index; i < cues.length - 1; i++) {
    const cur = cues[i]!;
    const next = cues[i + 1]!;
    if (next.start >= cur.end + minGap) break;
    shiftCue(next, cur.end + minGap - next.start);
  }
}
