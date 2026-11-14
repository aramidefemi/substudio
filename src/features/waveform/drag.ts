/**
 * Pure waveform pointer maths: what's under the pointer, and where a dragged
 * cue may go. No DOM, no store, so it is unit-tested directly.
 */

/** Half-width (px) of the zone around a cue edge that grabs the edge. */
export const EDGE_PX = 5;
/** Shortest a cue may be dragged to (seconds). */
export const MIN_CUE_LEN = 0.1;

export interface Span {
  start: number;
  end: number;
}

export type DragMode = "start" | "end" | "move";

export interface Hit {
  index: number;
  mode: DragMode;
}

/**
 * What a pointer at `x` (px from the canvas' left edge) grabs: a cue edge
 * (within `edgePx`), a cue's middle, or nothing. The nearest edge wins; on a
 * tie (two cues touching) the cue under the pointer, then the selected one.
 * Narrow cues shrink their edge zones so the middle stays grabbable.
 */
export function hitTest(
  cues: readonly Span[],
  x: number,
  viewStart: number,
  pps: number,
  selectedIndex = -1,
  edgePx = EDGE_PX,
): Hit | null {
  const t = viewStart + x / pps;
  const reach = edgePx / pps;
  let best: Hit | null = null;
  let bestScore = Infinity;
  let inside = -1;
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i]!;
    if (c.start > t + reach) break; // sorted by start: nothing further can be near
    if (c.end < t - reach) continue;
    const x0 = (c.start - viewStart) * pps;
    const x1 = (c.end - viewStart) * pps;
    const zone = Math.min(edgePx, Math.max(2, (x1 - x0) / 3));
    const contains = t >= c.start && t <= c.end;
    // Tiny bias so ties go to the cue under the pointer, then the selected cue.
    const bias = (contains ? 0.02 : 0) + (i === selectedIndex ? 0.01 : 0);
    for (const [mode, ex] of [
      ["start", x0],
      ["end", x1],
    ] as const) {
      const d = Math.abs(x - ex);
      if (d <= zone && d - bias < bestScore) {
        bestScore = d - bias;
        best = { index: i, mode };
      }
    }
    if (contains && (inside < 0 || i === selectedIndex)) inside = i;
  }
  return best ?? (inside >= 0 ? { index: inside, mode: "move" } : null);
}

export interface DragInput {
  mode: DragMode;
  /** The cue's times when the drag began. */
  origin: Span;
  /** Neighbours' times when the drag began. */
  prev?: Span;
  next?: Span;
  /** Pointer travel in seconds since the drag began. */
  dt: number;
  /** Alt held: the neighbour's facing edge moves along, keeping the gap. */
  linked?: boolean;
  minLen?: number;
}

export interface DragResult extends Span {
  /** New end of the previous cue (its original end when not linked). */
  prevEnd?: number;
  /** New start of the next cue (its original start when not linked). */
  nextStart?: number;
}

const ms = (t: number) => Math.round(t * 1000) / 1000;

/** Clamp to [lo, hi], widened to include `orig` so already-bad data never jumps. */
function clampKeep(v: number, lo: number, hi: number, orig: number) {
  return Math.max(Math.min(lo, orig), Math.min(Math.max(hi, orig), v));
}

/**
 * Times for a cue (and, when linked, its neighbour) after dragging by `dt`.
 * The cue never crosses its neighbours and never gets shorter than `minLen`;
 * a linked neighbour never gets shorter than `minLen` either.
 */
export function dragCue({ mode, origin, prev, next, dt, linked = false, minLen = MIN_CUE_LEN }: DragInput): DragResult {
  const out: DragResult = { start: origin.start, end: origin.end };
  if (prev) out.prevEnd = prev.end;
  if (next) out.nextStart = next.start;

  if (mode === "start") {
    const hi = origin.end - minLen;
    if (linked && prev) {
      const gap = origin.start - prev.end;
      const lo = Math.max(0, prev.start + minLen + gap);
      out.start = clampKeep(ms(origin.start + dt), lo, hi, origin.start);
      out.prevEnd = out.start - gap;
    } else {
      const lo = prev ? prev.end : 0;
      out.start = clampKeep(ms(origin.start + dt), lo, hi, origin.start);
    }
  } else if (mode === "end") {
    const lo = origin.start + minLen;
    if (linked && next) {
      const gap = next.start - origin.end;
      const hi = next.end - minLen - gap;
      out.end = clampKeep(ms(origin.end + dt), lo, hi, origin.end);
      out.nextStart = out.end + gap;
    } else {
      const hi = next ? next.start : Infinity;
      out.end = clampKeep(ms(origin.end + dt), lo, hi, origin.end);
    }
  } else {
    const len = origin.end - origin.start;
    const lo = prev ? prev.end : 0;
    const hi = next ? next.start - len : Infinity;
    out.start = clampKeep(ms(origin.start + dt), lo, hi, origin.start);
    out.end = out.start + len;
  }
  return out;
}

/** CSS cursor for a hit (or for the empty waveform). */
export function cursorFor(hit: Hit | null, dragging = false): string {
  if (!hit) return "text";
  if (hit.mode === "move") return dragging ? "grabbing" : "grab";
  return "ew-resize";
}
