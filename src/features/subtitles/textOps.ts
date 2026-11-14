import { stripTags } from "./format";
import { DEFAULT_RULES } from "./rules";

/** Collapse line breaks to spaces (SE Unbreak). */
export function unbreak(text: string): string {
  return text.replace(/\s*\n\s*/g, " ").replace(/ {2,}/g, " ").trim();
}

function plainLen(s: string) {
  return stripTags(s).length;
}

function isInsideTag(text: string, index: number): boolean {
  const lt = text.lastIndexOf("<", index);
  const gt = text.lastIndexOf(">", index);
  return lt > gt;
}

/** Best space index to split into two lines under `maxLen`. */
function bestBreakIndex(text: string, maxLen: number): number {
  let best = -1;
  let bestScore = Infinity;
  for (let i = 1; i < text.length - 1; i++) {
    if (text[i] !== " " || isInsideTag(text, i)) continue;
    const left = text.slice(0, i).trimEnd();
    const right = text.slice(i + 1).trimStart();
    if (!left || !right) continue;
    const l = plainLen(left);
    const r = plainLen(right);
    let score = Math.abs(l - r);
    if (l > maxLen) score += (l - maxLen) * 20;
    if (r > maxLen) score += (r - maxLen) * 20;
    if (/[.!?…,;:]$/.test(stripTags(left).trimEnd())) score -= 8;
    if (/^[-–—]/.test(stripTags(right).trimStart())) score -= 12;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function splitAt(text: string, index: number): string {
  return `${text.slice(0, index).trimEnd()}\n${text.slice(index + 1).trimStart()}`;
}

/**
 * Auto-break into (usually) two lines at max length.
 * Prefers dialog dashes and punctuation near the midpoint.
 */
export function autoBreak(text: string, maxLen = DEFAULT_RULES.maxLineLength): string {
  const flat = unbreak(text);
  if (!flat) return flat;

  // Dialog: "Said this. - Replied that." — break even when under maxLen.
  const dialog = flat.match(/^(.+?[.!?…])\s+([-–—]\s+.+)$/);
  if (dialog) {
    const a = dialog[1]!;
    const b = dialog[2]!;
    if (plainLen(a) <= maxLen * 1.25 && plainLen(b) <= maxLen * 1.25) return `${a}\n${b}`;
  }

  if (plainLen(flat) <= maxLen) return flat;

  const at = bestBreakIndex(flat, maxLen);
  if (at >= 0) return splitAt(flat, at);

  // Soft fallback: break after maxLen characters at next space, else hard cut.
  let i = Math.min(maxLen, flat.length - 1);
  while (i < flat.length && (flat[i] !== " " || isInsideTag(flat, i))) i++;
  if (i < flat.length) return splitAt(flat, i);
  return `${flat.slice(0, maxLen)}\n${flat.slice(maxLen)}`;
}

/** Rebalance into two lines (unbreak then auto-break). */
export function balanceLines(text: string, maxLen = DEFAULT_RULES.maxLineLength): string {
  const flat = unbreak(text);
  if (plainLen(flat) <= 1) return flat;
  return autoBreak(flat, maxLen);
}

function joinBreak(text: string, at: number): { text: string; cursor: number } {
  const left = text.slice(0, at);
  const right = text.slice(at + 1);
  const needSpace = /\S$/.test(left) && /^\S/.test(right);
  return { text: left + (needSpace ? " " : "") + right, cursor: left.length + (needSpace ? 1 : 0) };
}

/** Insert or remove a line break at the caret (space under the caret becomes the break). */
export function toggleLineBreak(text: string, cursor: number): { text: string; cursor: number } {
  const c = Math.max(0, Math.min(cursor, text.length));
  if (text[c] === "\n") return joinBreak(text, c);
  if (c > 0 && text[c - 1] === "\n") return joinBreak(text, c - 1);
  if (text[c] === " ") return { text: text.slice(0, c) + "\n" + text.slice(c + 1), cursor: c + 1 };
  if (c > 0 && text[c - 1] === " ") return { text: text.slice(0, c - 1) + "\n" + text.slice(c), cursor: c };
  return { text: text.slice(0, c) + "\n" + text.slice(c), cursor: c + 1 };
}

/** Replace the first space at/after the caret with a line break. */
export function breakAtFirstSpace(text: string, cursor: number): { text: string; cursor: number } | null {
  let i = Math.max(0, Math.min(cursor, text.length));
  while (i < text.length && (text[i] !== " " || isInsideTag(text, i))) i++;
  if (i >= text.length) return null;
  return { text: splitAt(text, i), cursor: i + 1 };
}

const DASH_PREFIX = /^([-–—])\s+/;

function visibleStart(line: string): string {
  return stripTags(line).trimStart();
}

function lineHasDialogDash(line: string): boolean {
  return DASH_PREFIX.test(visibleStart(line));
}

function addDialogDash(line: string): string {
  if (!line.trim()) return line;
  if (lineHasDialogDash(line)) return line;
  const lead = line.match(/^\s*/)?.[0] ?? "";
  const rest = line.slice(lead.length);
  const tags = rest.match(/^((?:<[^>]+>\s*)+)/)?.[1];
  if (tags) return `${lead}${tags}- ${rest.slice(tags.length)}`;
  return `${lead}- ${rest}`;
}

function removeDialogDash(line: string): string {
  if (!lineHasDialogDash(line)) return line;
  const lead = line.match(/^\s*/)?.[0] ?? "";
  const rest = line.slice(lead.length);
  const tags = rest.match(/^((?:<[^>]+>\s*)+)/)?.[1];
  if (tags) return `${lead}${tags}${rest.slice(tags.length).replace(DASH_PREFIX, "")}`;
  return lead + rest.replace(DASH_PREFIX, "");
}

/** Add or remove leading "- " on each non-empty line. */
export function toggleDialogDashes(text: string): string {
  const lines = text.split("\n");
  const targets = lines.filter((l) => visibleStart(l).length > 0);
  if (!targets.length) return text;
  const remove = targets.every(lineHasDialogDash);
  return lines.map((l) => (visibleStart(l) ? (remove ? removeDialogDash(l) : addDialogDash(l)) : l)).join("\n");
}

/** Trim each line; drop leading/trailing blank lines. */
export function trimWhitespace(text: string): string {
  return text
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}
/* ---------- moving words between neighbouring cues (EDT-11) ---------- */

/** New texts for a cue and the one after it. */
export interface TextPair {
  first: string;
  second: string;
}

/** Join two text fragments with one space (either may be empty). */
function joinWords(a: string, b: string): string {
  const left = a.trimEnd();
  const right = b.trimStart();
  return left && right ? `${left} ${right}` : left || right;
}

/** First word of the next cue moves up to the end of this one. Null when the next cue is empty. */
export function moveFirstWordUp(first: string, second: string): TextPair | null {
  const m = /^\s*(\S+)\s*/.exec(second);
  if (!m) return null;
  return { first: joinWords(first, m[1]!), second: second.slice(m[0].length).trimEnd() };
}

/** Last word of this cue moves down to the start of the next. Null when this cue is empty. */
export function moveLastWordDown(first: string, second: string): TextPair | null {
  const m = /\s*(\S+)\s*$/.exec(first);
  if (!m) return null;
  return { first: first.slice(0, m.index), second: joinWords(m[1]!, second) };
}

/** Text from `cursor` to the end of this cue moves to the start of the next. Null when nothing is after the cursor. */
export function moveTextFromCursorDown(first: string, cursor: number, second: string): TextPair | null {
  const at = Math.max(0, Math.min(first.length, cursor));
  const moved = first.slice(at).trim();
  if (!moved) return null;
  return { first: first.slice(0, at).trimEnd(), second: joinWords(moved, second) };
}
