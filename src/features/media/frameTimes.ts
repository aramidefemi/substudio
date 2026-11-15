/** SSFT binary frame timestamps from Rust `media::encode_frame_times` (MED-01). */

const MAGIC = "SSFT";
const VERSION = 1;

export function parseFrameTimes(buffer: ArrayBuffer): Float64Array {
  const view = new DataView(buffer);
  if (buffer.byteLength < 9) throw new Error("bad frame-times header");
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== MAGIC) throw new Error("bad frame-times magic");
  if (view.getUint8(4) !== VERSION) throw new Error("unsupported frame-times version");
  const n = view.getUint32(5, true);
  if (buffer.byteLength !== 9 + n * 8) throw new Error("frame-times length mismatch");
  const times = new Float64Array(n);
  for (let i = 0; i < n; i++) times[i] = view.getFloat64(9 + i * 8, true);
  return times;
}

const EPS = 1e-4;

/** Index of the frame at or before `t` (last timestamp ≤ t). */
export function frameIndexAt(times: ArrayLike<number>, t: number): number {
  let lo = 0;
  let hi = times.length - 1;
  if (hi < 0) return 0;
  if (t <= times[0]! + EPS) return 0;
  if (t >= times[hi]! - EPS) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid]! <= t + EPS) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Step `frames` display frames along the source timeline. Falls back to fps
 * grid when timestamps are missing (MED-03 consumes the same helper).
 */
export function stepAlongFrames(
  t: number,
  frames: number,
  times: ArrayLike<number> | null | undefined,
  fps: number,
): number {
  if (!frames) return t;
  if (times && times.length > 0) {
    const i = frameIndexAt(times, t);
    const onFrame = Math.abs(times[i]! - t) <= EPS;
    let next: number;
    if (frames > 0) {
      next = i + (onFrame ? frames : Math.max(1, frames));
    } else {
      next = onFrame ? i + frames : i + frames + 1;
    }
    const clamped = Math.max(0, Math.min(times.length - 1, next));
    return Math.max(0, times[clamped]!);
  }
  // CFR fallback — same behaviour as timing.stepFrames
  if (fps <= 0) return t;
  const f = t * fps;
  const base = frames > 0 ? Math.floor(f + 1e-3) : Math.ceil(f - 1e-3);
  return Math.max(0, (base + frames) / fps);
}

/** Snap `t` to the nearest source timestamp; CFR `fps` grid when times missing. Tie → earlier. */
export function snapToNearestFrame(
  t: number,
  times: ArrayLike<number> | null | undefined,
  fps: number,
): number {
  if (times && times.length > 0) {
    const i = frameIndexAt(times, t);
    const a = times[i]!;
    const b = i + 1 < times.length ? times[i + 1]! : a;
    // Prefer later only when clearly closer; EPS ties → earlier frame.
    if (b !== a && Math.abs(t - b) + EPS < Math.abs(t - a)) return Math.max(0, b);
    return Math.max(0, a);
  }
  if (fps > 0) return Math.max(0, Math.round(t * fps) / fps);
  return t;
}

/** Next source frame after `start`, or `start + 1/fps` when at the last / no times. */
function nextFrameAfter(
  start: number,
  times: ArrayLike<number> | null | undefined,
  fps: number,
): number {
  if (times && times.length > 0) {
    const next = frameIndexAt(times, start) + 1;
    if (next < times.length) return times[next]!;
  }
  if (fps > 0) return start + 1 / fps;
  return start;
}

/** Snap cue edges to source frames (MED-03). Mutates like `snapAllToFrames`. */
export function snapAllToSourceFrames(
  cues: { start: number; end: number }[],
  times: ArrayLike<number> | null | undefined,
  fps: number,
): void {
  for (const c of cues) {
    c.start = snapToNearestFrame(c.start, times, fps);
    c.end = snapToNearestFrame(c.end, times, fps);
    if (c.end <= c.start) c.end = nextFrameAfter(c.start, times, fps);
  }
}
