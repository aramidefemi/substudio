/**
 * Silence detection on waveform peaks (pure). "Silent" is relative to how
 * loud the audio is locally, so quiet dialogue scenes and loud music scenes
 * both work, with an absolute floor for near-digital silence.
 */
import type { Span } from "./drag";
import type { Peaks } from "./peaks";

export interface SilenceOptions {
  /** A bucket is silent below this fraction of the local loudness. */
  ratio: number;
  /** ...or below this absolute level (0–1), whichever is higher. */
  floor: number;
  /** Seconds either side of a point used to measure local loudness. */
  window: number;
  /** Local loudness is this percentile of nearby levels (robust to single clicks). */
  percentile: number;
  /** Shortest pause (seconds) that counts as silence. */
  minSilence: number;
}

export const SILENCE_DEFAULTS: SilenceOptions = {
  ratio: 0.15,
  floor: 0.02,
  window: 3,
  percentile: 0.9,
  minSilence: 0.2,
};

/** How far (seconds) a seek looks before giving up. */
export const SEEK_HORIZON = 120;
/** How far (seconds) a guessed edge may move from the current one. */
export const GUESS_REACH = 1;

const CHUNK_S = 0.5;

function percentileOf(values: Uint8Array, from: number, to: number, p: number): number {
  if (to <= from) return 0;
  const slice = Array.from(values.subarray(from, to)).sort((a, b) => a - b);
  return slice[Math.min(slice.length - 1, Math.floor(p * slice.length))]!;
}

/**
 * Silent runs (seconds) of at least `minSilence` inside [t0, t1]. Runs cut
 * by the range edges are clipped to it.
 */
export function silentRuns(p: Peaks, t0: number, t1: number, opts: Partial<SilenceOptions> = {}): Span[] {
  const o = { ...SILENCE_DEFAULTS, ...opts };
  const n = p.values.length;
  const from = Math.max(0, Math.floor(t0 * p.rate));
  const to = Math.min(n, Math.ceil(t1 * p.rate));
  if (to <= from) return [];

  // Threshold per chunk, from loudness in a window around the chunk.
  const chunk = Math.max(1, Math.round(CHUNK_S * p.rate));
  const reach = Math.round(o.window * p.rate);
  const thresholds: number[] = [];
  const thresholdAt = (i: number) => {
    const c = Math.floor((i - from) / chunk);
    let th = thresholds[c];
    if (th === undefined) {
      const mid = from + c * chunk + (chunk >> 1);
      const local = percentileOf(p.values, Math.max(0, mid - reach), Math.min(n, mid + reach), o.percentile) / 255;
      th = thresholds[c] = Math.max(o.floor, local * o.ratio);
    }
    return th;
  };

  const minLen = Math.max(1, Math.round(o.minSilence * p.rate));
  const runs: Span[] = [];
  let runStart = -1;
  const close = (end: number) => {
    if (runStart >= 0 && end - runStart >= minLen) runs.push({ start: runStart / p.rate, end: end / p.rate });
    runStart = -1;
  };
  for (let i = from; i < to; i++) {
    const silent = p.values[i]! / 255 < thresholdAt(i);
    if (silent && runStart < 0) runStart = i;
    else if (!silent) close(i);
  }
  close(to);
  return runs;
}

const EPS = 0.01;

/**
 * Start of the next (dir 1) or previous (dir -1) silence from `t`, or null
 * when there is none within `SEEK_HORIZON`.
 */
export function seekSilence(p: Peaks, t: number, dir: 1 | -1, opts?: Partial<SilenceOptions>): number | null {
  if (dir > 0) {
    const run = silentRuns(p, t, t + SEEK_HORIZON, opts).find((r) => r.start > t + EPS);
    return run ? run.start : null;
  }
  const runs = silentRuns(p, Math.max(0, t - SEEK_HORIZON), t, opts).filter((r) => r.start < t - EPS);
  // The first run may be clipped by the search range; that's fine, it's the furthest.
  return runs.length ? runs[runs.length - 1]!.start : null;
}

const nearest = (candidates: number[], t: number, reach: number): number | null => {
  let best: number | null = null;
  for (const c of candidates) if (Math.abs(c - t) <= reach && (best === null || Math.abs(c - t) < Math.abs(best - t))) best = c;
  return best;
};

/**
 * Guess where speech starts and stops around a cue: the nearest
 * silence→sound change to its start and sound→silence change to its end,
 * each within `GUESS_REACH`. An edge is null when nothing fits.
 */
export function guessCueTimes(
  p: Peaks,
  cue: Span,
  opts?: Partial<SilenceOptions>,
): { start: number | null; end: number | null } {
  const reach = GUESS_REACH;
  const from = Math.max(0, cue.start - reach - 1);
  const runs = silentRuns(p, from, cue.end + reach + 1, opts);
  const onsets = runs.map((r) => r.end);
  const offsets = runs.map((r) => r.start);
  // Audio that is already loud at 0 s starts there.
  if (from === 0 && (!runs.length || runs[0]!.start > 0)) onsets.push(0);
  return { start: nearest(onsets, cue.start, reach), end: nearest(offsets, cue.end, reach) };
}
