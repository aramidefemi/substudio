import { formatTime, parseTime, type TimeFormat } from "./timecode";
import { MIN_GAP } from "./timing";
import type { CueData } from "./types";

/* ---------- SYN-01: adjust times by an offset ---------- */

/** Which lines an offset / rescale applies to. */
export type ShiftScope = "all" | "selected" | "selectedAndFollowing";

const OFFSET_RE = /^(?:(\d+):)?(?:(\d+):)?(\d+)([,.:])(\d{1,3})$/;

/**
 * Parses a signed offset typed as a timecode: `+00:00:02:12`, `-00:00:01,500`.
 * Leading fields may be left out (`-2:12` is two seconds and 12 frames,
 * `1:02,500` is a minute and 2.5 seconds). The last separator decides the
 * unit, like `parseTime`: `:` frames, `,` or `.` milliseconds. Returns seconds
 * (negative for `-`/`−`), or null when the text isn't an offset.
 */
export function parseOffset(input: string, fmt: TimeFormat): number | null {
  let s = input.trim().replace(/\s+/g, "");
  let sign = 1;
  if (/^[-−+]/.test(s)) {
    if (s[0] !== "+") sign = -1;
    s = s.slice(1);
  }
  const m = OFFSET_RE.exec(s);
  if (!m) return null;
  const [, a, b, sec, sep, frac] = m;
  // One leading field is minutes; two are hours and minutes.
  const [h, min] = b !== undefined ? [a, b] : ["0", a ?? "0"];
  const t = parseTime(`${h}:${min}:${sec}${sep}${frac}`, fmt);
  return t === null ? null : sign * t;
}

/** `+00:00:02:12` / `−00:00:01,500` in the project's timecode mode. */
export function formatOffset(delta: number, fmt: TimeFormat): string {
  return `${delta < 0 ? "−" : "+"}${formatTime(Math.abs(delta), fmt)}`;
}

/** Indices of the cues whose id is in `ids`, ascending. */
export function indicesOf(cues: readonly { id: string }[], ids: readonly string[]): number[] {
  const set = new Set(ids);
  return cues.flatMap((c, i) => (set.has(c.id) ? [i] : []));
}

/**
 * Indices an offset touches, in order. `selected` must be sorted ascending.
 * "Selected and following" starts at the earliest selected line.
 */
export function scopeIndices(count: number, selected: readonly number[], scope: ShiftScope): number[] {
  if (scope === "all") return Array.from({ length: count }, (_, i) => i);
  if (!selected.length) return [];
  if (scope === "selected") return [...selected];
  const from = Math.min(...selected);
  return Array.from({ length: count - from }, (_, i) => from + i);
}

/** Where a cue lands after shifting by `delta` (same clamping as the move commands). */
export function shiftedTimes(cue: CueData, delta: number): { start: number; end: number } {
  const start = Math.max(0, cue.start + delta);
  return { start, end: Math.max(start + MIN_GAP, cue.end + delta) };
}

/** How many of `indices` would start before zero (and get clamped there). */
export function countClamped(cues: readonly CueData[], indices: readonly number[], delta: number): number {
  return indices.reduce((n, i) => n + (cues[i]!.start + delta < 0 ? 1 : 0), 0);
}

/* ---------- SYN-03: change frame rate / change speed ---------- */

/** Common broadcast / film rates for the frame-rate dialog. */
export const COMMON_FPS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60] as const;

/**
 * Factor that converts times from `fromFps` to `toFps`
 * (`newTime = oldTime * fromFps / toFps`). Null when either rate is invalid.
 */
export function frameRateFactor(fromFps: number, toFps: number): number | null {
  if (!(fromFps > 0) || !(toFps > 0) || !Number.isFinite(fromFps) || !Number.isFinite(toFps)) return null;
  return fromFps / toFps;
}

/** Parse a positive fps or speed factor from a typed field. */
export function parsePositive(input: string): number | null {
  const n = Number(input.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Where a cue lands after multiplying times by `factor` (clamp at zero / MIN_GAP). */
export function scaledTimes(cue: CueData, factor: number): { start: number; end: number } {
  const start = Math.max(0, cue.start * factor);
  return { start, end: Math.max(start + MIN_GAP, cue.end * factor) };
}

/** Mutate `indices` in place by `factor`. No-op when factor is 1. */
export function scaleIndices(cues: CueData[], indices: readonly number[], factor: number): void {
  if (!indices.length || factor === 1) return;
  for (const i of indices) {
    const c = cues[i];
    if (!c) continue;
    const { start, end } = scaledTimes(c, factor);
    c.start = start;
    c.end = end;
  }
}

/** How many of `indices` would start before zero after scaling (only when factor < 0 — unused for fps/speed). */
export function countScaled(cues: readonly CueData[], indices: readonly number[], factor: number): number {
  let n = 0;
  for (const i of indices) {
    const c = cues[i]!;
    const next = scaledTimes(c, factor);
    if (next.start !== c.start || next.end !== c.end) n++;
  }
  return n;
}
