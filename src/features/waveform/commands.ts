import type { Command } from "@/app/commands/registry";
import { focusCueText } from "@/lib/dom";
import { clearRegion, createCueFromRegion } from "./region";

/** Enter outside text: a marked region becomes a cue; otherwise edit the selected cue's text. */
export const enterOutsideText = () => createCueFromRegion() || focusCueText();

/** Waveform commands; spread into `COMMANDS` in `app/commands/definitions.ts`. */
export const WAVEFORM_COMMANDS: Command[] = [
  { id: "waveform.createFromRegion", label: "Create subtitle from marked region", group: "Waveform", run: createCueFromRegion },
  { id: "waveform.clearRegion", label: "Clear marked region", group: "Waveform", keys: ["Escape"], scope: "outsideText", run: clearRegion },
];
