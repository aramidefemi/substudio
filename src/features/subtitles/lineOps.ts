import { MIN_GAP } from "./timing";
import type { CueData } from "./types";

export type MergeMode = "keepBreaks" | "unbreak" | "dialog";

const dialogLine = (t: string) => {
  const flat = t.replace(/\n/g, " ").trim();
  if (!flat) return "-";
  return flat.startsWith("-") ? flat : `- ${flat}`;
};

/** Join many cue texts (Subtitle Edit merge variants). */
export function mergeMany(texts: readonly string[], mode: MergeMode): string {
  if (!texts.length) return "";
  if (mode === "unbreak") {
    return texts
      .map((t) => t.replace(/\n/g, " ").trim())
      .filter(Boolean)
      .join(" ");
  }
  if (mode === "dialog") return texts.map(dialogLine).join("\n");
  return texts.reduce((a, b) => {
    if (!a) return b;
    if (!b) return a;
    return `${a}\n${b}`;
  }, "");
}

export const mergeTexts = (a: string, b: string, mode: MergeMode) => mergeMany([a, b], mode);

/** Split text at a caret; trims the join edges so lines stay clean. */
export function splitTextAt(text: string, cursor: number): [string, string] {
  const i = Math.max(0, Math.min(text.length, cursor));
  return [text.slice(0, i).replace(/\s+$/, ""), text.slice(i).replace(/^\s+/, "")];
}

/**
 * Split one cue's times at `at` (seconds). Text for each half is supplied by the caller.
 * Returns null if `at` is too close to either edge.
 */
export function splitCueAtTime(
  cue: CueData,
  at: number,
  leftText: string,
  rightText: string,
  minGap = MIN_GAP,
): { left: CueData; right: CueData } | null {
  if (at <= cue.start + minGap || at >= cue.end - minGap) return null;
  return {
    left: { start: cue.start, end: at, text: leftText },
    right: { start: at, end: cue.end, text: rightText },
  };
}

/** Split times proportionally by left/right character weight (min 1 each). */
export function splitCueAtCursor(
  cue: CueData,
  cursor: number,
  minGap = MIN_GAP,
): { left: CueData; right: CueData } | null {
  const [leftText, rightText] = splitTextAt(cue.text, cursor);
  const leftW = Math.max(1, leftText.length);
  const rightW = Math.max(1, rightText.length);
  const at = cue.start + ((cue.end - cue.start) * leftW) / (leftW + rightW);
  return splitCueAtTime(cue, at, leftText, rightText, minGap);
}

/** Fit a `duration` cue into `[after, before)`, clamped to the free window. */
export function fitCueInGap(
  after: number,
  before: number | null,
  duration: number,
  minGap = MIN_GAP,
): { start: number; end: number } | null {
  const start = Math.max(0, after);
  let end = start + duration;
  if (before != null) {
    const limit = before - minGap;
    if (limit - start < minGap) return null;
    end = Math.min(end, limit);
  }
  if (end - start < minGap) return null;
  return { start, end };
}

/**
 * Ripple amount: span from first to last selected inclusive.
 * Later cues shift earlier by this so the hole closes.
 */
export function rippleSpan(cues: readonly CueData[], indices: readonly number[]): number {
  if (!indices.length) return 0;
  const lo = Math.min(...indices);
  const hi = Math.max(...indices);
  return Math.max(0, cues[hi]!.end - cues[lo]!.start);
}
