import { edit, useSubtitles } from "./store";
import {
  frameRateFactor,
  indicesOf,
  scaleIndices,
  scopeIndices,
  type ShiftScope,
} from "./retime";
import { shiftIndices } from "./timing";
import type { Cue } from "./types";

/** Retiming operations on the open document (SYN-01, SYN-03). Each one is a single undo step. */

const byStart = (a: Cue, b: Cue) => a.start - b.start;
const isSorted = (cues: readonly Cue[]) => cues.every((c, i) => i === 0 || cues[i - 1]!.start <= c.start);

/** Indices of the selected cues, ascending. */
export function selectedIndices(): number[] {
  const { cues, selectedIds } = useSubtitles.getState();
  return indicesOf(cues, selectedIds);
}

/** Indices `scope` covers in the current document. */
export function indicesForScope(scope: ShiftScope): number[] {
  return scopeIndices(useSubtitles.getState().cues.length, selectedIndices(), scope);
}

/**
 * SYN-01: shift lines by `delta` seconds. Reuses the move commands' helper, then
 * re-sorts in case selected lines moved past unselected ones. Returns how many
 * lines it shifted.
 */
export function shiftByOffset(scope: ShiftScope, delta: number): number {
  const indices = indicesForScope(scope);
  if (!indices.length || !delta) return 0;
  edit((doc) => {
    shiftIndices(doc.cues, indices, delta, false);
    if (!isSorted(doc.cues)) doc.cues.sort(byStart);
  });
  return indices.length;
}

/**
 * SYN-03: multiply times by `factor` (change speed). Re-sorts if needed.
 * Returns how many lines it touched, or 0 when nothing moves.
 */
export function rescaleByFactor(scope: ShiftScope, factor: number): number {
  const indices = indicesForScope(scope);
  if (!indices.length || !(factor > 0) || factor === 1) return 0;
  edit((doc) => {
    scaleIndices(doc.cues, indices, factor);
    if (!isSorted(doc.cues)) doc.cues.sort(byStart);
  });
  return indices.length;
}

/**
 * SYN-03: rescale times from `fromFps` → `toFps` and set the project fps to `toFps`
 * when `scope` is all (so the timecode grid matches). Returns how many lines moved.
 */
export function changeFrameRate(scope: ShiftScope, fromFps: number, toFps: number): number {
  const factor = frameRateFactor(fromFps, toFps);
  if (factor === null || factor === 1) {
    // Still adopt the new project fps when converting "all" with equal rates.
    if (scope === "all" && toFps > 0 && useSubtitles.getState().fps !== toFps) {
      useSubtitles.setState({ fps: toFps });
    }
    return 0;
  }
  const indices = indicesForScope(scope);
  if (!indices.length) return 0;
  edit((doc) => {
    scaleIndices(doc.cues, indices, factor);
    if (!isSorted(doc.cues)) doc.cues.sort(byStart);
  });
  if (scope === "all" && toFps > 0) useSubtitles.setState({ fps: toFps });
  return indices.length;
}
