import type { Cue, CueData } from "./types";

const isUntimed = (c: CueData) => (c as Cue).untimed === true;

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
  const issues: CueIssues = {};
  // Untimed script lines are placeholders until the timing pass (SCR-01/02).
  if (isUntimed(cue)) {
    const longest = Math.max(0, ...cue.text.split("\n").map((l) => l.length));
    if (longest > rules.maxLineLength) {
      issues.text = `Line too long: ${longest} chars (max ${rules.maxLineLength})`;
    }
    return issues;
  }
  const s = cueStats(cue);
  if (prev && !isUntimed(prev) && cue.start < prev.end - 1e-6) {
    issues.start = "Overlaps the previous subtitle";
  }
  if (s.duration < rules.minDuration) issues.duration = `Too short: under ${rules.minDuration} s`;
  else if (s.duration > rules.maxDuration) issues.duration = `Too long: over ${rules.maxDuration} s`;
  if (s.cps > rules.maxCps) {
    issues.text = `Reads too fast: ${s.cps.toFixed(1)} chars/sec (max ${rules.maxCps})`;
  } else if (s.longestLine > rules.maxLineLength) {
    issues.text = `Line too long: ${s.longestLine} chars (max ${rules.maxLineLength})`;
  }
  return issues;
}

export type IssueColumn = keyof CueIssues;

export interface ListedIssue {
  /** Cue index in document order. */
  index: number;
  column: IssueColumn;
  reason: string;
}

const COLUMN_ORDER: IssueColumn[] = ["start", "duration", "text"];

/** Every problem `checkCue` flags, in document order (one row per cue and column). */
export function listIssues(cues: readonly CueData[], rules = DEFAULT_RULES): ListedIssue[] {
  const out: ListedIssue[] = [];
  cues.forEach((cue, index) => {
    const issues = checkCue(cue, cues[index - 1], rules);
    for (const column of COLUMN_ORDER) {
      const reason = issues[column];
      if (reason) out.push({ index, column, reason });
    }
  });
  return out;
}
