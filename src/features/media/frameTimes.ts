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
