import { selectedCues, selectSelectedCue, useSubtitles } from "@/features/subtitles/store";
import { stepFrames } from "@/features/subtitles/timing";
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
