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
}

export type SubtitleFormat = "srt" | "vtt";
