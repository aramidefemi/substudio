import type { Command } from "@/app/commands/registry";
import { focusCueText } from "@/lib/dom";
import { insertHere, splitHere } from "./context";
import { clearRegion, createCueFromRegion } from "./region";

/** Enter outside text: a marked region becomes a cue; otherwise edit the selected cue's text. */
export const enterOutsideText = () => createCueFromRegion() || focusCueText();

/** Waveform commands; spread into `COMMANDS` in `app/commands/definitions.ts`. */
export const WAVEFORM_COMMANDS: Command[] = [
  { id: "waveform.createFromRegion", label: "Create subtitle from marked region", group: "Waveform", run: createCueFromRegion },
  // Position-aware: act where the waveform was right-clicked (the playhead from elsewhere).
  { id: "waveform.insertHere", label: "Insert subtitle at waveform position", group: "Waveform", hidden: true, run: insertHere },
  { id: "waveform.splitHere", label: "Split at waveform position", group: "Waveform", hidden: true, run: splitHere },
  { id: "waveform.clearRegion", label: "Clear marked region", group: "Waveform", keys: ["Escape"], scope: "outsideText", run: clearRegion },
];
