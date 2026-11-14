import type { Cue } from "./types";

export const isBookmarked = (cue: Pick<Cue, "bookmark">) => cue.bookmark !== undefined;

/** Index of the next (dir 1) or previous (dir −1) bookmarked cue after `from`, wrapping; −1 if none. */
export function nextBookmarkIndex(cues: readonly Pick<Cue, "bookmark">[], from: number, dir: 1 | -1): number {
  const n = cues.length;
  for (let step = 1; step <= n; step++) {
    const i = (((from + dir * step) % n) + n) % n;
    if (isBookmarked(cues[i]!)) return i;
  }
  return -1;
}
