/** SSSC binary shot timestamps from Rust `shot_changes::encode` (SYN-04). */

const MAGIC = "SSSC";

export function parseShotChanges(buffer: ArrayBuffer): Float64Array {
  const view = new DataView(buffer);
  if (buffer.byteLength < 9) throw new Error("bad shot-changes header");
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== MAGIC) throw new Error("bad shot-changes magic");
  if (view.getUint8(4) !== 1) throw new Error("unsupported shot-changes version");
  const n = view.getUint32(5, true);
  if (buffer.byteLength !== 9 + n * 8) throw new Error("shot-changes length mismatch");
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = view.getFloat64(9 + i * 8, true);
  return out;
}

/** Largest shot strictly before `t`, or null. */
export function previousShot(shots: ArrayLike<number> | null | undefined, t: number): number | null {
  if (!shots || shots.length === 0) return null;
  let best: number | null = null;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i]!;
    if (s < t - 1e-6) best = s;
    else break;
  }
  return best;
}

/** Smallest shot strictly after `t`, or null. */
export function nextShot(shots: ArrayLike<number> | null | undefined, t: number): number | null {
  if (!shots || shots.length === 0) return null;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i]!;
    if (s > t + 1e-6) return s;
  }
  return null;
}

/** Nearest shot to `t` within `maxDist` (seconds); null when none. */
export function nearestShot(
  shots: ArrayLike<number> | null | undefined,
  t: number,
  maxDist = Infinity,
): number | null {
  if (!shots || shots.length === 0) return null;
  let best: number | null = null;
  let bestD = maxDist;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i]!;
    const d = Math.abs(s - t);
    if (d <= bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/**
 * Green-zone half-width (seconds): edges inside this band of a shot are
 * candidates for snap. ~2 frames at 25 fps.
 */
export const GREEN_ZONE = 0.08;

/** Snap one edge to the nearest shot when inside the green zone (or always if maxDist is Infinity). */
export function snapTimeToShot(
  t: number,
  shots: ArrayLike<number> | null | undefined,
  maxDist = GREEN_ZONE * 4,
): number {
  return nearestShot(shots, t, maxDist) ?? t;
}

export interface CueEdges {
  start: number;
  end: number;
}

const MIN_DUR = 0.04;

/** Snap cue start/end each to nearest shot (prefer start ≤ end). Mutates `cue`. */
export function snapCueToShots(cue: CueEdges, shots: ArrayLike<number> | null | undefined, maxDist = 0.5): void {
  if (!shots || shots.length === 0) return;
  const start = nearestShot(shots, cue.start, maxDist);
  const end = nearestShot(shots, cue.end, maxDist);
  if (start != null) cue.start = start;
  if (end != null) cue.end = Math.max(cue.start + MIN_DUR, end);
  if (cue.end <= cue.start) cue.end = cue.start + MIN_DUR;
}

/** Sanitize a sidecar array into a sorted unique Float64Array (or null if empty). */
export function normalizeShotList(raw: unknown): Float64Array | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const nums = raw.filter((t): t is number => typeof t === "number" && Number.isFinite(t) && t >= 0);
  if (!nums.length) return null;
  nums.sort((a, b) => a - b);
  const out: number[] = [];
  for (const t of nums) {
    if (!out.length || t - out[out.length - 1]! >= 1e-4) out.push(t);
  }
  return Float64Array.from(out);
}

/**
 * Toggle a shot at `t`: remove the nearest marker within `eps`, otherwise insert
 * `t` (sorted). Returns the next list (null when empty) and whether a marker was added.
 */
export function toggleShotAt(
  shots: ArrayLike<number> | null | undefined,
  t: number,
  eps = GREEN_ZONE,
): { next: Float64Array | null; added: boolean } {
  const time = Math.round(Math.max(0, t) * 1000) / 1000;
  const hit = nearestShot(shots, time, eps);
  if (hit != null) {
    const kept: number[] = [];
    for (let i = 0; i < (shots?.length ?? 0); i++) {
      const s = shots![i]!;
      if (Math.abs(s - hit) > 1e-6) kept.push(s);
    }
    return { next: kept.length ? Float64Array.from(kept) : null, added: false };
  }
  const merged = [...(shots ? Array.from(shots as ArrayLike<number>) : []), time];
  return { next: normalizeShotList(merged), added: true };
}
