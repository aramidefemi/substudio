/** Mirrors `subtitles::Cue` in Rust. Times are seconds. */
export interface CueData {
  start: number;
  end: number;
  text: string;
  /** ASS/SSA style name when present (FMT-01). Ignored for SRT/VTT. */
  style?: string;
}

export interface Cue extends CueData {
  /** Frontend-only stable id for selection and list keys. */
  id: string;
  /** Bookmark note; present (possibly "") when the cue is bookmarked (NAV-02). Saved in the project sidecar, not the SRT. */
  bookmark?: string;
  /**
   * Script import (SCR-01): not yet timed. Times are placeholders (often 0/0);
   * cleared when start/end are set. Not written to SRT.
   */
  untimed?: boolean;
  /**
   * Source/script text beside the translation (FIL-07). Present (possibly "")
   * while an original is open. Saved in the project sidecar, not the SRT.
   */
  original?: string;
}

export type SubtitleFormat = "srt" | "vtt" | "ass" | "ssa" | "sbv" | "ttml" | "dfxp";

/** Mirrors `formats::ass::AssKind`. */
export type AssKind = "ass" | "ssa";

/**
 * Basic ASS/SSA style fields (FMT-01). Kept as session state beside the cue list
 * (not per-cue undo): loaded on open, passed back on save. SRT/VTT leave this null.
 */
export interface AssStyle {
  name: string;
  fontname: string;
  fontsize: number;
  /** ASS `&HAABBGGRR` (or SSA decimal string). */
  primaryColour: string;
  bold: boolean;
  italic: boolean;
  /** Numpad alignment 1–9. */
  alignment: number;
}
