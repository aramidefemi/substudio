/** Find & replace matching (EDT-04). Pure: works on plain strings, no store access. */

export interface SearchOptions {
  query: string;
  matchCase: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export type Matcher = { ok: true; re: RegExp } | { ok: false; error: string };

// Word characters include combining marks so Yoruba tone marks (ẹ̀, ọ́) stay inside a word.
const WORD = String.raw`[\p{L}\p{M}\p{N}_]`;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Builds a global, Unicode regex for the options; null when the query is empty. */
export function buildMatcher(opts: SearchOptions): Matcher | null {
  if (!opts.query) return null;
  const body = opts.regex ? opts.query : escapeRegex(opts.query);
  const source = opts.wholeWord ? `(?<!${WORD})(?:${body})(?!${WORD})` : body;
  try {
    return { ok: true, re: new RegExp(source, opts.matchCase ? "gu" : "giu") };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message.replace(/^Invalid regular expression: /, "") };
  }
}

export interface Range {
  start: number;
  end: number;
}

/** Non-empty matches in `text` (empty regex matches like `^` or `a*` are skipped). */
export function findMatches(text: string, re: RegExp): Range[] {
  const out: Range[] = [];
  for (const m of text.matchAll(re)) {
    if (m[0].length) out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

export interface Hit extends Range {
  /** Index into the searched texts (cue index). */
  index: number;
  /** True when the search went past the end (or start) and came round. */
  wrapped: boolean;
}

export interface Position {
  index: number;
  /** Next: matches starting at or after this offset. Previous: matches starting before it. */
  offset: number;
}

function lastWhere<T>(list: readonly T[], pred: (x: T) => boolean): T | undefined {
  for (let i = list.length - 1; i >= 0; i--) if (pred(list[i]!)) return list[i];
  return undefined;
}

/** Next or previous match from `from`, wrapping round the document once. */
export function findFrom(texts: readonly string[], re: RegExp, from: Position, dir: 1 | -1): Hit | null {
  const n = texts.length;
  if (!n) return null;
  const startIndex = Math.max(0, Math.min(n - 1, from.index));
  for (let step = 0; step <= n; step++) {
    const index = (((startIndex + dir * step) % n) + n) % n;
    const matches = findMatches(texts[index]!, re);
    const wrapped = dir > 0 ? startIndex + step >= n : startIndex - step < 0;
    let hit: Range | undefined;
    if (step === 0) {
      hit = dir > 0 ? matches.find((m) => m.start >= from.offset) : lastWhere(matches, (m) => m.start < from.offset);
    } else if (step === n) {
      // Back at the starting cue after wrapping: the part we skipped at step 0.
      hit = dir > 0 ? matches.find((m) => m.start < from.offset) : lastWhere(matches, (m) => m.start >= from.offset);
    } else {
      hit = dir > 0 ? matches[0] : matches.at(-1);
    }
    if (hit) return { index, ...hit, wrapped };
  }
  return null;
}

/** Total matches across all texts. */
export function countMatches(texts: readonly string[], re: RegExp): number {
  return texts.reduce((sum, t) => sum + findMatches(t, re).length, 0);
}

/**
 * Replaces every match in `text`. With `regex`, `$1`, `$&`, `$<name>` expand as in
 * String.replace, and empty matches count too (so `^` → "- " prefixes each cue);
 * otherwise the replacement is literal (a `$` stays a `$`).
 */
export function replaceInText(text: string, re: RegExp, replacement: string, regex: boolean): { text: string; count: number } {
  const count = [...text.matchAll(re)].length;
  if (!count) return { text, count };
  return { text: regex ? text.replace(re, replacement) : text.replace(re, () => replacement), count };
}

/** Replaces only the match at `range` (the current hit). Returns null if it no longer matches there. */
export function replaceAt(text: string, re: RegExp, range: Range, replacement: string, regex: boolean): string | null {
  // A sticky copy matches exactly at `range.start` while still seeing the text around it (lookbehind).
  const sticky = new RegExp(re.source, re.flags.replace("g", "") + "y");
  sticky.lastIndex = range.start;
  const m = sticky.exec(text);
  if (!m || m[0].length !== range.end - range.start) return null;
  if (!regex) return text.slice(0, range.start) + replacement + text.slice(range.end);
  sticky.lastIndex = range.start;
  return text.replace(sticky, replacement);
}

/** New texts for every text that changes under replace-all, plus the total count. */
export function replaceAll(
  texts: readonly string[],
  re: RegExp,
  replacement: string,
  regex: boolean,
): { changes: Map<number, string>; count: number } {
  const changes = new Map<number, string>();
  let count = 0;
  texts.forEach((t, i) => {
    const r = replaceInText(t, re, replacement, regex);
    if (r.count && r.text !== t) changes.set(i, r.text);
    count += r.count;
  });
  return { changes, count };
}
