import { clock } from "@/features/playback/clock";
import { splitCueAtTime } from "@/features/subtitles/lineOps";
import { cueIndexAt, insertCue, select, splitSelectedAtTime, useSubtitles } from "@/features/subtitles/store";
import type { Cue } from "@/features/subtitles/types";
import { focusCueText } from "@/lib/dom";

/** What a right-click on the waveform at `time` can do. */
export interface MenuTarget {
  time: number;
  /** Cue under the pointer, or null on empty space. */
  cueId: string | null;
  canInsert: boolean;
  canSplit: boolean;
  canMergePrevious: boolean;
  canMergeNext: boolean;
}

export function menuTarget(cues: readonly Cue[], time: number): MenuTarget {
  const i = cueIndexAt(cues, time);
  const cue = i >= 0 ? cues[i]! : null;
  return {
    time,
    cueId: cue?.id ?? null,
    canInsert: !cue,
    canSplit: !!cue && splitCueAtTime(cue, time, "", "") !== null,
    canMergePrevious: i > 0,
    canMergeNext: i >= 0 && i < cues.length - 1,
  };
}

/**
 * Time the position-aware waveform commands act on: where the context menu
 * was opened, or the playhead when they run from elsewhere (palette).
 */
let pointerTime: number | null = null;

export const setPointerTime = (t: number | null) => {
  pointerTime = t;
};
/** Right-click time when a waveform menu command runs; otherwise the playhead. */
export const actionTime = () => pointerTime ?? clock.time;

/** Insert an empty cue at the waveform position (fitted before the next cue) and edit its text. */
export function insertHere() {
  insertCue(actionTime());
  requestAnimationFrame(() => focusCueText());
}

/** Split the cue under the waveform position there; the right half starts empty. */
export function splitHere() {
  const t = actionTime();
  const { cues } = useSubtitles.getState();
  const i = cueIndexAt(cues, t);
  if (i < 0) return;
  select(cues[i]!.id);
  if (splitSelectedAtTime(t)) requestAnimationFrame(() => focusCueText());
}
