import { cueStats } from "./rules";
import type { CueData } from "./types";

export interface FileStats {
  lines: number;
  chars: number;
  words: number;
  totalDuration: number;
  avgDuration: number;
  avgCps: number;
  maxCps: number;
  minGap: number | null;
  overlaps: number;
}

/** Bucket edges for CPS histogram (chars/sec). */
export const CPS_BUCKETS = [0, 5, 10, 15, 17, 20, 25, 30, Infinity] as const;

export type CpsHistogram = { label: string; count: number }[];

function wordCount(text: string): number {
  const t = text.replace(/<[^>]+>/g, " ").trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

export function computeStats(cues: readonly CueData[]): FileStats {
  let chars = 0;
  let words = 0;
  let totalDuration = 0;
  let cpsSum = 0;
  let maxCps = 0;
  let overlaps = 0;
  let minGap: number | null = null;

  for (let i = 0; i < cues.length; i++) {
    const c = cues[i]!;
    const s = cueStats(c);
    chars += s.chars;
    words += wordCount(c.text);
    totalDuration += s.duration;
    cpsSum += s.cps;
    if (s.cps > maxCps) maxCps = s.cps;
    const prev = cues[i - 1];
    if (prev) {
      if (c.start < prev.end - 1e-6) overlaps += 1;
      else {
        const gap = c.start - prev.end;
        if (minGap === null || gap < minGap) minGap = gap;
      }
    }
  }

  const n = cues.length;
  return {
    lines: n,
    chars,
    words,
    totalDuration,
    avgDuration: n ? totalDuration / n : 0,
    avgCps: n ? cpsSum / n : 0,
    maxCps,
    minGap,
    overlaps,
  };
}

export function cpsHistogram(cues: readonly CueData[]): CpsHistogram {
  const counts = new Array(CPS_BUCKETS.length - 1).fill(0) as number[];
  for (const c of cues) {
    const cps = cueStats(c).cps;
    for (let i = 0; i < counts.length; i++) {
      const lo = CPS_BUCKETS[i]!;
      const hi = CPS_BUCKETS[i + 1]!;
      if (cps >= lo && cps < hi) {
        counts[i]! += 1;
        break;
      }
    }
  }
  return counts.map((count, i) => {
    const lo = CPS_BUCKETS[i]!;
    const hi = CPS_BUCKETS[i + 1]!;
    const label = hi === Infinity ? `${lo}+` : `${lo}–${hi}`;
    return { label, count };
  });
}
