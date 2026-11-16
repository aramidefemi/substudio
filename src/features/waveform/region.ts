import { create } from "zustand";
import { addCue, useSubtitles } from "@/features/subtitles/store";
import { focusCueText } from "@/lib/dom";
import type { Span } from "./drag";

/**
 * A marked time range on the waveform (drag on empty space). Enter or a
 * double-click inside it turns it into a cue; Escape clears it.
 */
export const useRegion = create<{ region: Span | null }>()(() => ({ region: null }));

export const setRegion = (region: Span | null) => useRegion.setState({ region });
export const clearRegion = () => {
  if (useRegion.getState().region) setRegion(null);
};

export const regionContains = (r: Span | null, t: number) => !!r && t >= r.start && t <= r.end;

/** The empty stretch around `t` between neighbouring cues, or null when `t` is inside a cue. */
export function gapAround(cues: readonly Span[], t: number): { lo: number; hi: number } | null {
  let lo = 0;
  let hi = Infinity;
  for (const c of cues) {
    if (t >= c.start && t <= c.end) return null;
    if (c.end < t) lo = Math.max(lo, c.end);
    else if (c.start > t) {
      hi = Math.min(hi, c.start);
      break; // sorted by start: later cues start even later
    }
  }
  return { lo, hi };
}

const ms = (t: number) => Math.round(t * 1000) / 1000;

/** Region between the press time and the pointer, kept inside the gap it started in. */
export function regionFromDrag(anchor: number, t: number, gap: { lo: number; hi: number }): Span {
  const a = Math.max(gap.lo, Math.min(gap.hi, anchor));
  const b = Math.max(gap.lo, Math.min(gap.hi, t));
  return { start: ms(Math.min(a, b)), end: ms(Math.max(a, b)) };
}

/** Plain cue text from the clipboard (BOM/CRLF stripped; outer whitespace trimmed). */
export function clipboardAsCueText(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

/** Turn the marked region into a cue (optional text), select it and focus its text. False when there is no region. */
export function createCueFromRegion(text = ""): boolean {
  const { region } = useRegion.getState();
  if (!region) return false;
  addCue(region.start, region.end, text);
  setRegion(null);
  requestAnimationFrame(() => focusCueText());
  return true;
}

/**
 * Paste clipboard plain text into the marked region as one timed cue (undoable).
 * No region → false (menu disables; SE "Paste into marked region" needs a mark).
 */
export async function pasteClipboardIntoRegion(): Promise<boolean> {
  if (!useRegion.getState().region) return false;
  const text = clipboardAsCueText(await navigator.clipboard.readText());
  return createCueFromRegion(text);
}

// A region belongs to one document: drop it when another file loads.
useSubtitles.subscribe((s, prev) => {
  if (s.filePath !== prev.filePath || (s.cues.length === 0 && prev.cues.length > 0)) clearRegion();
});
