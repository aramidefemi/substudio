import type { CueData } from "./types";

/** Reading-speed and timing limits. Will become per-client presets. */
export interface Rules {
  minDuration: number;
  maxDuration: number;
  maxCps: number;
  maxLineLength: number;
}

export const DEFAULT_RULES: Rules = {
  minDuration: 1,
  maxDuration: 7,
  maxCps: 17,
  maxLineLength: 42,
};

export function cueStats(cue: CueData) {
  const duration = cue.end - cue.start;
  const lineLengths = cue.text.split("\n").map((l) => l.length);
  const chars = lineLengths.reduce((a, b) => a + b, 0);
  return {
    duration,
    chars,
    cps: duration > 0 ? chars / duration : 0,
    lineLengths,
    longestLine: Math.max(0, ...lineLengths),
  };
}

/** Human-readable problems per column; an absent key means that column is fine. */
export interface CueIssues {
  start?: string;
  duration?: string;
  text?: string;
}

export function checkCue(cue: CueData, prev: CueData | undefined, rules = DEFAULT_RULES): CueIssues {
  const s = cueStats(cue);
  const issues: CueIssues = {};
  if (prev && cue.start < prev.end - 1e-6) issues.start = "Overlaps the previous subtitle";
  if (s.duration < rules.minDuration) issues.duration = `Too short: under ${rules.minDuration} s`;
  else if (s.duration > rules.maxDuration) issues.duration = `Too long: over ${rules.maxDuration} s`;
  if (s.cps > rules.maxCps) {
    issues.text = `Reads too fast: ${s.cps.toFixed(1)} chars/sec (max ${rules.maxCps})`;
  } else if (s.longestLine > rules.maxLineLength) {
    issues.text = `Line too long: ${s.longestLine} chars (max ${rules.maxLineLength})`;
  }
  return issues;
}
