import type { Command } from "@/app/commands/registry";
import { focusCueText } from "@/lib/dom";
import { insertHere, splitHere } from "./context";
import { clearRegion, createCueFromRegion } from "./region";
import { guessTimesAction, seekSilenceAction } from "./speech";
import { toggleWaveDisplay } from "./view";

/** Enter outside text: a marked region becomes a cue; otherwise edit the selected cue's text. */
export const enterOutsideText = () => createCueFromRegion() || focusCueText();

/** Waveform commands; spread into `COMMANDS` in `app/commands/definitions.ts`. */
export const WAVEFORM_COMMANDS: Command[] = [
  { id: "waveform.createFromRegion", label: "Create subtitle from marked region", group: "Waveform", run: createCueFromRegion },
  // Position-aware: act where the waveform was right-clicked (the playhead from elsewhere).
  { id: "waveform.insertHere", label: "Insert subtitle at waveform position", group: "Waveform", hidden: true, run: insertHere },
  { id: "waveform.splitHere", label: "Split at waveform position", group: "Waveform", hidden: true, run: splitHere },
  { id: "waveform.clearRegion", label: "Clear marked region", group: "Waveform", keys: ["Escape"], scope: "outsideText", run: clearRegion },
  // ⌥[ / ⌥] type characters on macOS, so these only fire outside text.
  { id: "waveform.seekSilenceBack", label: "Seek silence back", group: "Waveform", keys: ["Alt+BracketLeft"], scope: "outsideText", run: () => seekSilenceAction(-1) },
  { id: "waveform.seekSilenceForward", label: "Seek silence forward", group: "Waveform", keys: ["Alt+BracketRight"], scope: "outsideText", run: () => seekSilenceAction(1) },
  { id: "waveform.guessStart", label: "Guess start from waveform", group: "Waveform", keys: ["Alt+Shift+BracketLeft"], scope: "outsideText", run: () => guessTimesAction("start") },
  { id: "waveform.guessEnd", label: "Guess end from waveform", group: "Waveform", keys: ["Alt+Shift+BracketRight"], scope: "outsideText", run: () => guessTimesAction("end") },
  { id: "waveform.guessTimes", label: "Guess start and end from waveform", group: "Waveform", run: () => guessTimesAction("both") },
  {
    id: "waveform.toggleSpectrogram",
    label: "Toggle spectrogram",
    group: "Waveform",
    keys: ["$mod+Shift+KeyW"],
    run: toggleWaveDisplay,
  },
];
