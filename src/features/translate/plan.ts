import { stripTags } from "@/features/subtitles/format";
import { hasOriginal } from "@/features/subtitles/original";
import { autoBreak, unbreak } from "@/features/subtitles/textOps";
import type { Cue } from "@/features/subtitles/types";
import type { TranslateEngine } from "./languages";

/**
 * Auto-translate planning (TRN-01), pure so it is easy to test.
 *
 * Model: the source always lives in the Original column and the translation in
 * Text. If the document has no original column yet, the first run copies every
 * line's text into it, so the source stays visible beside the draft and a
 * second run (or a retry after an error) works from the same place.
 */

export interface PlanOptions {
  /** Only these cue ids; null = every line. */
  scope: ReadonlySet<string> | null;
  /** Leave lines that already hold a translation (text that differs from the original). */
  skipTranslated: boolean;
}

export interface PlanItem {
  id: string;
  /** What goes to Google. */
  send: string;
  /** The whole line was `<i>…</i>`: translate the inside, wrap it again. */
  italic: boolean;
  /** Dialog lines (`- A` / `- B`): keep one line per speaker. */
  dialog: boolean;
}

export interface Plan {
  /** No original column yet: copy text → original before writing translations. */
  seedOriginals: boolean;
  items: PlanItem[];
  /** In-scope lines left alone (blank, music only, or already translated). */
  skipped: number;
  /** In scope (items + skipped). */
  inScope: number;
}

const DASH = /^[-–—]/;
const WHOLE_ITALIC = /^<i>([\s\S]*)<\/i>$/i;

/** Lines with nothing to translate: blank, or only symbols such as ♪. */
export const hasWords = (text: string) => /\p{L}/u.test(stripTags(text));

/** True when the line already carries a translation that differs from its source. */
export function isTranslated(cue: Pick<Cue, "text" | "original">): boolean {
  const text = cue.text.trim();
  return text !== "" && text !== (cue.original ?? "").trim();
}

/** Where the source text comes from for one cue. */
export const sourceText = (cue: Pick<Cue, "text" | "original">, seeding: boolean) =>
  seeding ? cue.text : (cue.original ?? "");

/** Turn one source line into what we send. */
export function prepare(id: string, source: string): PlanItem {
  let text = source.trim();
  let italic = false;
  const m = text.match(WHOLE_ITALIC);
  if (m && !/<\/?i>/i.test(m[1]!)) {
    italic = true;
    text = m[1]!.trim();
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const dialog = lines.length > 1 && lines.every((l) => DASH.test(l));
  // Ordinary lines are one thought broken for reading: send them unbroken so
  // Google sees the whole sentence; we re-break to the target's line length.
  return { id, send: dialog ? lines.join("\n") : unbreak(text), italic, dialog };
}

export function buildPlan(cues: readonly Cue[], opts: PlanOptions): Plan {
  const seedOriginals = !cues.some(hasOriginal);
  const items: PlanItem[] = [];
  let skipped = 0;
  let inScope = 0;
  for (const cue of cues) {
    if (opts.scope && !opts.scope.has(cue.id)) continue;
    inScope++;
    const source = sourceText(cue, seedOriginals);
    if (!hasWords(source) || (!seedOriginals && opts.skipTranslated && isTranslated(cue))) {
      skipped++;
      continue;
    }
    items.push(prepare(cue.id, source));
  }
  return { seedOriginals, items, skipped, inScope };
}

/** Google sometimes returns `< i>` or `</ I>`: put tags back the way SRT wants them. */
const normalizeTags = (text: string) => text.replace(/<\s*(\/?)\s*([ibu])\s*>/gi, (_, slash: string, tag: string) => `<${slash}${tag.toLowerCase()}>`);

/** Turn Google's answer back into a subtitle line that fits the reading rules. */
export function finish(item: PlanItem, translated: string, maxLineLength: number): string {
  let text = normalizeTags(translated).replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").trim();
  if (item.dialog) {
    text = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n");
  } else {
    text = unbreak(text);
    if (stripTags(text).length > maxLineLength) text = autoBreak(text, maxLineLength);
  }
  return item.italic && text ? `<i>${text}</i>` : text;
}

/** Request size per engine: the free endpoint likes small batches. */
export const BATCH_LIMITS: Record<TranslateEngine, { items: number; chars: number }> = {
  "google-free": { items: 40, chars: 4000 },
  "google-cloud": { items: 100, chars: 20000 },
};

/** Greedy batches under both limits; a single oversize item still gets its own batch. */
export function chunk<T extends { send: string }>(items: readonly T[], limits: { items: number; chars: number }): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let chars = 0;
  for (const item of items) {
    const len = item.send.length;
    if (cur.length && (cur.length >= limits.items || chars + len > limits.chars)) {
      out.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(item);
    chars += len;
  }
  if (cur.length) out.push(cur);
  return out;
}
