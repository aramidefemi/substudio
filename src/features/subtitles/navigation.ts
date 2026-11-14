import { checkCue, DEFAULT_RULES, type Rules } from "./rules";
import type { CueData } from "./types";

/** First index after (`dir` 1) or before (-1) `from` that matches, or -1. `from` -1 means "before the first line". */
function findFrom(count: number, from: number, dir: 1 | -1, match: (i: number) => boolean): number {
  const start = from < 0 ? (dir > 0 ? 0 : -1) : from + dir;
  for (let i = start; i >= 0 && i < count; i += dir) if (match(i)) return i;
  return -1;
}

const hasIssue = (cues: readonly CueData[], i: number, rules: Rules) =>
  Object.keys(checkCue(cues[i]!, cues[i - 1], rules)).length > 0;

/** Next / previous line with a problem `checkCue` flags (NAV-01). */
export function findError(cues: readonly CueData[], from: number, dir: 1 | -1, rules = DEFAULT_RULES): number {
  return findFrom(cues.length, from, dir, (i) => hasIssue(cues, i, rules));
}

/** Next line whose text is empty or whitespace. */
export function findEmpty(cues: readonly CueData[], from: number): number {
  return findFrom(cues.length, from, 1, (i) => !cues[i]!.text.trim());
}

/** Small slack so repeated presses step past the line the playhead was just put on. */
const VIDEO_EPS = 0.05;

/**
 * Line that starts after (`dir` 1) or before (-1) the playhead `t`. Going back
 * from the middle of a line lands on that line's start first, like a player's
 * "previous track".
 */
export function lineFromVideo(cues: readonly CueData[], t: number, dir: 1 | -1): number {
  if (dir > 0) return cues.findIndex((c) => c.start > t + VIDEO_EPS);
  for (let i = cues.length - 1; i >= 0; i--) if (cues[i]!.start < t - VIDEO_EPS) return i;
  return -1;
}

/** "12" → index 11 for a 1-based line number typed by hand; clamps past the end; null when not a line number. */
export function parseLineNumber(input: string, count: number): number | null {
  const text = input.trim().replace(/^#/, "");
  if (!/^\d+$/.test(text) || count <= 0) return null;
  const n = Number(text);
  if (n < 1) return null;
  return Math.min(n, count) - 1;
}
