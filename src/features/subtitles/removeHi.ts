import type { CueData } from "./types";

export interface RemoveHiOptions {
  /** Strip [bracket] and （fullwidth） stage directions / SFX. */
  brackets: boolean;
  /** Strip (parenthetical) stage directions / SFX. */
  parentheses: boolean;
  /** Strip ♪…♪ / ♫…♫ lyric wrappers (and lone music notes). */
  music: boolean;
  /** Strip leading SPEAKER: / NAME - labels. */
  speakerColon: boolean;
  /** Drop cues that become empty after cleaning. */
  dropEmpty: boolean;
}

export const DEFAULT_REMOVE_HI: RemoveHiOptions = {
  brackets: true,
  parentheses: true,
  music: true,
  speakerColon: true,
  dropEmpty: true,
};

const BRACKET = /\[[^\]\n]*\]/g;
const PAREN = /\([^)\n]*\)/g;
const FULLWIDTH_PAREN = /（[^）\n]*）/g;
const MUSIC_BLOCK = /[♪♫][^♪♫\n]*[♪♫]/g;
const MUSIC_NOTE = /[♪♫]/g;
const SPEAKER = /^\s*(?:<[^>]+>\s*)*[A-Z][A-Z0-9 .'-]{0,40}\s*:\s*/;
const SPEAKER_DASH = /^\s*(?:<[^>]+>\s*)*[A-Z][A-Z0-9 .'-]{0,40}\s+[-–—]\s+/;

/** Clean one cue's text for hearing-impaired markup (QLT-06). */
export function removeHearingImpairedText(text: string, opts: RemoveHiOptions = DEFAULT_REMOVE_HI): string {
  let out = text;
  if (opts.brackets) out = out.replace(BRACKET, "");
  if (opts.parentheses) {
    out = out.replace(PAREN, "");
    out = out.replace(FULLWIDTH_PAREN, "");
  }
  if (opts.music) {
    out = out.replace(MUSIC_BLOCK, "");
    out = out.replace(MUSIC_NOTE, "");
  }
  if (opts.speakerColon) {
    out = out
      .split("\n")
      .map((line) => line.replace(SPEAKER, "").replace(SPEAKER_DASH, ""))
      .join("\n");
  }
  return out
    .split("\n")
    .map((l) => l.replace(/ {2,}/g, " ").trim())
    .join("\n")
    .replace(/^\n+|\n+$/g, "")
    .replace(/\n{2,}/g, "\n");
}

/** Apply HI removal across cues; optionally drop emptied lines. */
export function removeHearingImpaired(
  cues: readonly CueData[],
  opts: RemoveHiOptions = DEFAULT_REMOVE_HI,
): CueData[] {
  const mapped = cues.map((c) => ({ ...c, text: removeHearingImpairedText(c.text, opts) }));
  return opts.dropEmpty ? mapped.filter((c) => c.text.trim().length > 0) : mapped;
}
