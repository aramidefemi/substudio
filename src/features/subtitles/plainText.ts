import type { CueData } from "./types";

/** Split pasted/imported script text: one cue per non-empty line (blank lines skipped). */
export function plainTextLines(text: string): string[] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

/** Untimed cue payloads for import (start=end=0 placeholders). */
export function untimedCuesFromPlainText(text: string): CueData[] {
  return plainTextLines(text).map((line) => ({ start: 0, end: 0, text: line }));
}
