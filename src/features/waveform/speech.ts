import { toast } from "sonner";
import { clock } from "@/features/playback/clock";
import { selectSelectedIndex, setCueTimes, useSubtitles } from "@/features/subtitles/store";
import { MIN_CUE_LEN, type Span } from "./drag";
import { usePeaks } from "./peaks";
import { guessCueTimes, seekSilence } from "./silence";

function readyPeaks() {
  const { peaks } = usePeaks.getState();
  if (!peaks) toast("The waveform isn't ready", { description: "Open a video and wait for its audio to load." });
  return peaks;
}

/** Move the playhead to the start of the next / previous silence. */
export function seekSilenceAction(dir: 1 | -1) {
  const peaks = readyPeaks();
  if (!peaks) return;
  const t = seekSilence(peaks, clock.time, dir);
  if (t === null) toast(dir > 0 ? "No silence ahead" : "No silence before the playhead");
  else clock.seek(t);
}

export type GuessEdges = "start" | "end" | "both";

/**
 * Where the guessed edges may go: never across a neighbour, never shorter
 * than the minimum. Returns only the edges that change.
 */
export function fitGuess(
  cue: Span,
  guess: { start: number | null; end: number | null },
  edges: GuessEdges,
  prev?: Span,
  next?: Span,
): Partial<Span> {
  let start = edges !== "end" && guess.start !== null ? guess.start : cue.start;
  let end = edges !== "start" && guess.end !== null ? guess.end : cue.end;
  if (prev && start < prev.end) start = cue.start;
  if (next && end > next.start) end = cue.end;
  if (end - start < MIN_CUE_LEN) return {};
  const out: Partial<Span> = {};
  if (start !== cue.start) out.start = start;
  if (end !== cue.end) out.end = end;
  return out;
}

/** Snap the selected cue's start and/or end to where speech starts / stops (one undo step). */
export function guessTimesAction(edges: GuessEdges) {
  const peaks = readyPeaks();
  if (!peaks) return;
  const s = useSubtitles.getState();
  const i = selectSelectedIndex(s);
  const cue = s.cues[i];
  if (!cue) return;
  const change = fitGuess(cue, guessCueTimes(peaks, cue), edges, s.cues[i - 1], s.cues[i + 1]);
  if (change.start === undefined && change.end === undefined) {
    toast("No clear speech edge near this subtitle");
    return;
  }
  setCueTimes([{ id: cue.id, ...change }]);
}
