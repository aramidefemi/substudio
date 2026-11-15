/** Mirrors `subtitles::Cue` in Rust. Times are seconds. */
export interface CueData {
  start: number;
  end: number;
  text: string;
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
}

export type SubtitleFormat = "srt" | "vtt";
