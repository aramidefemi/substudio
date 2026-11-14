import { beginHeldCue, endHeldCue, select, selectedCues, selectSelectedCue, selectSelectedIndex, useSubtitles } from "@/features/subtitles/store";
import { stepFrames } from "@/features/subtitles/timing";
import { focusCueText } from "@/lib/dom";
import { clock } from "./clock";

/** Step the playhead by whole frames at the project fps. Pauses first, like a jog wheel. */
export function stepFrame(frames: number) {
  clock.pause();
  clock.seek(stepFrames(clock.time, useSubtitles.getState().fps, frames));
}

/** Jump the playhead by `seconds`; playback keeps going so she can re-listen. */
export function jump(seconds: number) {
  clock.seek(clock.time + seconds);
}

/** Speeds offered in the transport bar and stepped through by faster/slower. */
export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** Next speed up (`dir` 1) or down (-1) from the current rate. */
export function nextSpeed(rate: number, dir: 1 | -1): number {
  if (dir > 0) return SPEEDS.find((s) => s > rate + 1e-9) ?? SPEEDS.at(-1)!;
  return [...SPEEDS].reverse().find((s) => s < rate - 1e-9) ?? SPEEDS[0]!;
}

export const changeSpeed = (dir: 1 | -1) => clock.setRate(nextSpeed(clock.rate, dir));
export const resetSpeed = () => clock.setRate(1);

/** Cue being timed by a held key (TIM-01), if any. */
let heldId: string | null = null;

/** Hold-to-time key down: new cue at the playhead, open-ended until release. */
export function holdToTimeStart() {
  // A run from the menu or palette never gets a release; its cue keeps the provisional end.
  heldId = beginHeldCue(clock.time);
}

/** Hold-to-time key up: the cue ends at the playhead. */
export function holdToTimeEnd() {
  if (!heldId) return;
  endHeldCue(heldId, clock.time);
  heldId = null;
}

/** Seconds of lead-in for "play from just before the line". */
export const PRE_ROLL = 0.5;

/** First start → last end of the selected lines, or null when nothing is selected. */
export function selectionSpan(): { start: number; end: number } | null {
  const cues = selectedCues();
  if (!cues.length) return null;
  return { start: Math.min(...cues.map((c) => c.start)), end: Math.max(...cues.map((c) => c.end)) };
}

/** Play the selected line(s) start → end, then stop (or loop). */
export function playSelection(loop = false) {
  const span = selectionSpan();
  if (span) clock.playRange(span.start, span.end, loop);
}

/** Loop the selected line(s); a second press stops the loop. */
export function toggleLoopSelection() {
  if (clock.looping) clock.pause();
  else playSelection(true);
}

/** Play on from just before the selected line, so its first word isn't clipped. */
export function playBeforeSelection() {
  const cue = selectSelectedCue(useSubtitles.getState());
  if (cue) clock.playFrom(cue.start - PRE_ROLL);
}

/**
 * Select the next (`delta` 1) or previous (-1) line and play it, stopping at
 * its end or looping. With nothing selected, "next" starts at the first line.
 * Returns false at either end of the document.
 */
export function playNeighbour(delta: 1 | -1, loop = false): boolean {
  const s = useSubtitles.getState();
  const i = selectSelectedIndex(s);
  const cue = s.cues[i < 0 ? (delta > 0 ? 0 : -1) : i + delta];
  if (!cue) return false;
  select(cue.id);
  clock.playRange(cue.start, cue.end, loop);
  return true;
}

/** The listen-then-type loop: next line, play it, cursor in the text box. */
export function goToNextAndPlay() {
  if (playNeighbour(1)) requestAnimationFrame(() => focusCueText());
}
