/** Strip HTML-like subtitle tags for plain display. */
export function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}

export interface TextRun {
  text: string;
  italic?: boolean;
  bold?: boolean;
}

const OPEN = /<(i|b|em|strong)\b[^>]*>/i;
const CLOSE = /<\/(i|b|em|strong)\s*>/i;

function isItalic(tag: string) {
  const t = tag.toLowerCase();
  return t === "i" || t === "em";
}

function isBold(tag: string) {
  const t = tag.toLowerCase();
  return t === "b" || t === "strong";
}

/** Split subtitle text into italic/bold runs for grid rendering. */
export function formatRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let italic = 0;
  let bold = 0;
  let i = 0;
  while (i < text.length) {
    const slice = text.slice(i);
    const open = slice.match(OPEN);
    const close = slice.match(CLOSE);
    const openAt = open?.index ?? Infinity;
    const closeAt = close?.index ?? Infinity;
    const next = Math.min(openAt, closeAt);
    if (next === Infinity) {
      pushRun(runs, text.slice(i), italic > 0, bold > 0);
      break;
    }
    if (next > 0) pushRun(runs, text.slice(i, i + next), italic > 0, bold > 0);
    if (openAt < closeAt && open) {
      if (isItalic(open[1]!)) italic++;
      if (isBold(open[1]!)) bold++;
      i += next + open[0].length;
    } else if (close) {
      if (isItalic(close[1]!)) italic = Math.max(0, italic - 1);
      if (isBold(close[1]!)) bold = Math.max(0, bold - 1);
      i += next + close[0].length;
    }
  }
  return runs.length ? runs : [{ text: "" }];
}

function pushRun(runs: TextRun[], text: string, italic: boolean, bold: boolean) {
  if (!text) return;
  const last = runs.at(-1);
  if (last && !!last.italic === italic && !!last.bold === bold) {
    last.text += text;
    return;
  }
  runs.push({ text, ...(italic ? { italic: true } : {}), ...(bold ? { bold: true } : {}) });
}

/** Gap after `prev` before `cue` (seconds). Null when there is no previous cue. */
export function gapAfter(prev: { end: number } | undefined, cue: { start: number }): number | null {
  return prev ? cue.start - prev.end : null;
}
