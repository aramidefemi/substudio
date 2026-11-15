import type { Cue, CueData } from "./types";

const isUntimed = (c: CueData) => (c as Cue).untimed === true;

/**
 * Reading-speed and timing limits in effect, in seconds. Built from the active
 * rule profile (RUL-01, `ruleProfiles.ts`), which may give the gap in frames.
 */
export interface Rules {
  minDuration: number;
  maxDuration: number;
  maxCps: number;
  maxLineLength: number;
  maxLines: number;
  /** Seconds; 0 turns the gap check off. */
  minGap: number;
}

/** The "Default" profile: 1–7 s, 17 cps, 42 chars, 2 lines, no gap check. */
export const DEFAULT_RULES: Rules = {
  minDuration: 1,
  maxDuration: 7,
  maxCps: 17,
  maxLineLength: 42,
  maxLines: 2,
  minGap: 0,
};

/** SRT rounds to the millisecond, so allow half of one before calling a gap short. */
export const GAP_EPS = 0.0005;

export function cueStats(cue: CueData) {
  const duration = cue.end - cue.start;
  const lines = cue.text.split("\n");
  const lineLengths = lines.map((l) => l.length);
  const chars = lineLengths.reduce((a, b) => a + b, 0);
  return {
    duration,
    chars,
    cps: duration > 0 ? chars / duration : 0,
    lineLengths,
    lineCount: cue.text.trim() ? lines.length : 0,
    longestLine: Math.max(0, ...lineLengths),
  };
}

/** Human-readable problems per column; an absent key means that column is fine. */
export interface CueIssues {
  start?: string;
  duration?: string;
  text?: string;
}

/** 0.8333 → "0.833", 7 → "7". */
const secs = (s: number) => String(Number(s.toFixed(3)));
const ms = (s: number) => String(Math.round(s * 1000));

export function checkCue(cue: CueData, prev: CueData | undefined, rules = DEFAULT_RULES): CueIssues {
  const issues: CueIssues = {};
  // Untimed script lines are placeholders until the timing pass (SCR-01/02).
  if (isUntimed(cue)) {
    const longest = Math.max(0, ...cue.text.split("\n").map((l) => l.length));
    const lineCount = cue.text.trim() ? cue.text.split("\n").length : 0;
    const text: string[] = [];
    if (longest > rules.maxLineLength) text.push(`Line too long: ${longest} chars (max ${rules.maxLineLength})`);
    if (lineCount > rules.maxLines) text.push(`Too many lines: ${lineCount} (max ${rules.maxLines})`);
    if (text.length) issues.text = text.join("; ");
    return issues;
  }
  const s = cueStats(cue);
  if (prev && !isUntimed(prev) && cue.start < prev.end - 1e-6) {
    issues.start = "Overlaps the previous subtitle";
  } else if (prev && !isUntimed(prev) && rules.minGap > 0 && cue.start - prev.end < rules.minGap - GAP_EPS) {
    issues.start = `Gap too short: ${ms(cue.start - prev.end)} ms (min ${ms(rules.minGap)} ms)`;
  }
  if (s.duration < rules.minDuration) issues.duration = `Too short: under ${secs(rules.minDuration)} s`;
  else if (s.duration > rules.maxDuration) issues.duration = `Too long: over ${secs(rules.maxDuration)} s`;
  const text: string[] = [];
  if (s.cps > rules.maxCps) text.push(`Reads too fast: ${s.cps.toFixed(1)} chars/sec (max ${rules.maxCps})`);
  if (s.longestLine > rules.maxLineLength) {
    text.push(`Line too long: ${s.longestLine} chars (max ${rules.maxLineLength})`);
  }
  if (s.lineCount > rules.maxLines) text.push(`Too many lines: ${s.lineCount} (max ${rules.maxLines})`);
  if (text.length) issues.text = text.join("; ");
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
