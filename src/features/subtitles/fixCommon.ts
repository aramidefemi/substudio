import { DEFAULT_RULES } from "./rules";
import { MIN_GAP } from "./timing";
import type { CueData } from "./types";

export type FixId =
  | "overlaps"
  | "shortGaps"
  | "doubleSpaces"
  | "lineTrim"
  | "emptyLines"
  | "missingPeriods"
  | "dialogDashes"
  | "ocrEllipsis"
  | "lonelyLetters"
  | "italicSpaces";

export interface FixDef {
  id: FixId;
  label: string;
  description: string;
  defaultOn: boolean;
}

export const FIX_DEFS: FixDef[] = [
  { id: "overlaps", label: "Fix overlaps", description: "Push start so cues no longer overlap", defaultOn: true },
  { id: "shortGaps", label: "Fix short gaps", description: `Enforce at least ${MIN_GAP * 1000} ms between cues`, defaultOn: true },
  { id: "doubleSpaces", label: "Remove double spaces", description: "Collapse repeated spaces", defaultOn: true },
  { id: "lineTrim", label: "Trim lines", description: "Trim leading/trailing whitespace per line", defaultOn: true },
  { id: "emptyLines", label: "Remove empty lines", description: "Delete cues with no text", defaultOn: true },
  { id: "missingPeriods", label: "Add missing periods", description: "End dialog sentences with a period when missing", defaultOn: false },
  { id: "dialogDashes", label: "Normalize dialog dashes", description: "Use '- ' on multi-line dialog", defaultOn: false },
  { id: "ocrEllipsis", label: "Fix OCR ellipsis", description: "Replace .... with …", defaultOn: true },
  { id: "lonelyLetters", label: "Fix lonely letters", description: "Join 'I 'm' / 'don 't' OCR splits", defaultOn: true },
  { id: "italicSpaces", label: "Fix italic tag spaces", description: "Move spaces outside <i> tags", defaultOn: true },
];

export interface FixHit {
  fixId: FixId;
  index: number;
  before: string;
  after: string;
}

export interface FixResult {
  cues: CueData[];
  hits: FixHit[];
}

const enabled = (ids: readonly FixId[], id: FixId) => ids.includes(id);

function clone(cues: readonly CueData[]): CueData[] {
  return cues.map((c) => ({ ...c }));
}

function hit(hits: FixHit[], fixId: FixId, index: number, before: string, after: string) {
  if (before === after) return;
  hits.push({ fixId, index, before, after });
}

function fixText(text: string, ids: readonly FixId[], index: number, hits: FixHit[]): string {
  let t = text;
  const before = t;

  if (enabled(ids, "ocrEllipsis")) {
    const next = t.replace(/\.{3,}/g, "…");
    if (next !== t) {
      hit(hits, "ocrEllipsis", index, t, next);
      t = next;
    }
  }
  if (enabled(ids, "lonelyLetters")) {
    const next = t.replace(/\b([A-Za-z])\s+(['’][A-Za-z])/g, "$1$2");
    if (next !== t) {
      hit(hits, "lonelyLetters", index, t, next);
      t = next;
    }
  }
  if (enabled(ids, "italicSpaces")) {
    const next = t
      .replace(/<i>\s+/gi, " <i>")
      .replace(/\s+<\/i>/gi, "</i> ")
      .replace(/ {2,}/g, " ");
    if (next !== t) {
      hit(hits, "italicSpaces", index, t, next);
      t = next;
    }
  }
  if (enabled(ids, "doubleSpaces")) {
    const next = t.replace(/ {2,}/g, " ");
    if (next !== t) {
      hit(hits, "doubleSpaces", index, t, next);
      t = next;
    }
  }
  if (enabled(ids, "lineTrim")) {
    const next = t
      .split("\n")
      .map((l) => l.trim())
      .join("\n")
      .replace(/^\n+|\n+$/g, "");
    if (next !== t) {
      hit(hits, "lineTrim", index, t, next);
      t = next;
    }
  }
  if (enabled(ids, "dialogDashes")) {
    const lines = t.split("\n");
    if (lines.length >= 2 && lines.every((l) => l.trim())) {
      const next = lines
        .map((l) => {
          const trimmed = l.trim();
          if (/^[-–—]\s*/.test(trimmed)) return trimmed.replace(/^[-–—]\s*/, "- ");
          return `- ${trimmed}`;
        })
        .join("\n");
      if (next !== t) {
        hit(hits, "dialogDashes", index, t, next);
        t = next;
      }
    }
  }
  if (enabled(ids, "missingPeriods")) {
    const plain = t.replace(/<[^>]+>/g, "").trim();
    if (plain && !/[.!?…:]$/.test(plain) && /\p{L}/u.test(plain) && plain.length >= 12) {
      const next = `${t.trimEnd()}.`;
      hit(hits, "missingPeriods", index, t, next);
      t = next;
    }
  }

  if (t === before && hits.some((h) => h.index === index)) {
    // individual hits already recorded
  }
  return t;
}

function fixTiming(cues: CueData[], ids: readonly FixId[], hits: FixHit[], minGap: number): void {
  for (let i = 1; i < cues.length; i++) {
    const prev = cues[i - 1]!;
    const cur = cues[i]!;
    if (enabled(ids, "overlaps") && cur.start < prev.end - 1e-6) {
      const before = `${cur.start.toFixed(3)}`;
      const dur = Math.max(minGap, cur.end - cur.start);
      cur.start = prev.end;
      cur.end = cur.start + dur;
      hit(hits, "overlaps", i, before, cur.start.toFixed(3));
    }
    if (enabled(ids, "shortGaps") && cur.start < prev.end + minGap - 1e-6) {
      const before = `${cur.start.toFixed(3)}`;
      const dur = Math.max(minGap, cur.end - cur.start);
      cur.start = prev.end + minGap;
      cur.end = cur.start + dur;
      hit(hits, "shortGaps", i, before, cur.start.toFixed(3));
    }
  }
}

/** Preview + apply Fix common errors (QLT-01). */
export function fixCommonErrors(
  cues: readonly CueData[],
  fixIds: readonly FixId[],
  minGap = MIN_GAP,
): FixResult {
  const hits: FixHit[] = [];
  let out = clone(cues);

  for (let i = 0; i < out.length; i++) {
    out[i]!.text = fixText(out[i]!.text, fixIds, i, hits);
  }

  if (enabled(fixIds, "emptyLines")) {
    const kept: CueData[] = [];
    out.forEach((c, index) => {
      if (!c.text.trim()) {
        hit(hits, "emptyLines", index, "(empty)", "(removed)");
      } else {
        kept.push(c);
      }
    });
    out = kept;
  }

  fixTiming(out, fixIds, hits, minGap);

  // Re-check duration ceilings after timing pushes (soft: only when absurdly long).
  for (const c of out) {
    if (c.end - c.start > DEFAULT_RULES.maxDuration * 3) {
      c.end = c.start + DEFAULT_RULES.maxDuration;
    }
  }

  return { cues: out, hits };
}

export function defaultFixIds(): FixId[] {
  return FIX_DEFS.filter((f) => f.defaultOn).map((f) => f.id);
}

export function hitsByFix(hits: readonly FixHit[]): Record<FixId, number> {
  const counts = Object.fromEntries(FIX_DEFS.map((f) => [f.id, 0])) as Record<FixId, number>;
  for (const h of hits) counts[h.fixId] += 1;
  return counts;
}
