import { splitTextAt } from "./lineOps";

/** True when the cue carries an original/script field (FIL-07), including empty. */
export const hasOriginal = (c: { original?: string }) => c.original !== undefined;

/**
 * Pair script/original lines onto cues by index (approximate; Doc ≠ 1:1).
 * Extra lines are ignored; cues past the script clear any previous original.
 */
export function pairOriginalsByIndex(cueCount: number, lines: readonly string[]): (string | undefined)[] {
  return Array.from({ length: cueCount }, (_, i) => (i < lines.length ? lines[i]! : undefined));
}

/**
 * Split original text by the same character weight as the translation halves,
 * so split/merge keep the script column attached to the right cue.
 */
export function splitOriginalByWeight(
  original: string | undefined,
  leftWeight: number,
  rightWeight: number,
): [string | undefined, string | undefined] {
  if (original === undefined) return [undefined, undefined];
  if (!original) return ["", ""];
  const total = Math.max(1, leftWeight) + Math.max(1, rightWeight);
  const at = Math.round((original.length * Math.max(1, leftWeight)) / total);
  return splitTextAt(original, at);
}
