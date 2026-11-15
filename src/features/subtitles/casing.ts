import { stripTags } from "./format";
import type { CueData } from "./types";
import { MIN_GAP } from "./timing";

export type CasingMode = "lower" | "upper" | "sentence" | "proper" | "normal";

/** Title-ish casing that leaves short particles lower (SE "Proper Case"). */
const LOWER_PARTICLES = new Set([
  "a",
  "an",
  "the",
  "and",
  "but",
  "or",
  "nor",
  "for",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "as",
  "vs",
]);

function mapOutsideTags(text: string, mapPlain: (s: string) => string): string {
  return text.replace(/(<[^>]+>)|([^<]+)/g, (_, tag: string | undefined, plain: string | undefined) =>
    tag ? tag : mapPlain(plain ?? ""),
  );
}

function capitalizeWord(word: string): string {
  const m = word.match(/^(\W*)([\p{L}\p{N}])(.*)$/u);
  if (!m) return word;
  return `${m[1]}${m[2]!.toLocaleUpperCase()}${m[3]!.toLocaleLowerCase()}`;
}

function properCase(plain: string): string {
  const words = plain.split(/(\s+)/);
  let i = 0;
  return words
    .map((w) => {
      if (/^\s+$/.test(w)) return w;
      const lower = stripTags(w).toLocaleLowerCase();
      const out = i > 0 && LOWER_PARTICLES.has(lower) ? w.toLocaleLowerCase() : capitalizeWord(w);
      i += 1;
      return out;
    })
    .join("");
}

function sentenceCase(plain: string): string {
  const lower = plain.toLocaleLowerCase();
  return lower.replace(/(^|[.!?…]\s+)(\p{L})/gu, (_, p: string, c: string) => p + c.toLocaleUpperCase());
}

/** Change casing outside HTML tags (QLT-05). */
export function changeCasing(text: string, mode: CasingMode): string {
  if (mode === "normal") return text;
  if (mode === "lower") return mapOutsideTags(text, (s) => s.toLocaleLowerCase());
  if (mode === "upper") return mapOutsideTags(text, (s) => s.toLocaleUpperCase());
  if (mode === "sentence") return mapOutsideTags(text, sentenceCase);
  return mapOutsideTags(text, properCase);
}

export function changeCasingCues(cues: readonly CueData[], mode: CasingMode): CueData[] {
  return cues.map((c) => ({ ...c, text: changeCasing(c.text, mode) }));
}

const plainLen = (t: string) => stripTags(t).replace(/\s+/g, " ").trim().length;

/**
 * Merge consecutive short cues into one (SE Merge short lines).
 * `maxChars` is the max plain length of a cue that may be absorbed.
 */
export function mergeShortLines(
  cues: readonly CueData[],
  maxChars = 12,
  minGap = MIN_GAP,
): CueData[] {
  if (!cues.length) return [];
  const out: CueData[] = [{ ...cues[0]! }];
  for (let i = 1; i < cues.length; i++) {
    const cur = cues[i]!;
    const prev = out[out.length - 1]!;
    const gap = cur.start - prev.end;
    const short = plainLen(prev.text) <= maxChars || plainLen(cur.text) <= maxChars;
    if (short && gap <= minGap + 0.25 && plainLen(prev.text) + plainLen(cur.text) <= maxChars * 3) {
      prev.end = cur.end;
      prev.text = [prev.text.trimEnd(), cur.text.trimStart()].filter(Boolean).join("\n");
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

const normText = (t: string) => stripTags(t).replace(/\s+/g, " ").trim().toLowerCase();

/** Merge neighbouring cues with the same text (QLT-05). */
export function mergeSameText(cues: readonly CueData[], maxGap = 0.5): CueData[] {
  if (!cues.length) return [];
  const out: CueData[] = [{ ...cues[0]! }];
  for (let i = 1; i < cues.length; i++) {
    const cur = cues[i]!;
    const prev = out[out.length - 1]!;
    if (normText(prev.text) === normText(cur.text) && cur.start - prev.end <= maxGap) {
      prev.end = Math.max(prev.end, cur.end);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/** Merge neighbouring cues that share nearly the same start/end (QLT-05). */
export function mergeSameTime(cues: readonly CueData[], epsilon = 0.04): CueData[] {
  if (!cues.length) return [];
  const out: CueData[] = [{ ...cues[0]! }];
  for (let i = 1; i < cues.length; i++) {
    const cur = cues[i]!;
    const prev = out[out.length - 1]!;
    if (Math.abs(prev.start - cur.start) <= epsilon && Math.abs(prev.end - cur.end) <= epsilon) {
      const a = prev.text.trim();
      const b = cur.text.trim();
      if (a && b && a !== b) prev.text = `${a}\n${b}`;
      else if (b && !a) prev.text = b;
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}
