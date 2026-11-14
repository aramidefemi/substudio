import { useSubtitles } from "@/features/subtitles/store";
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
