import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import type { SpellCheckResult, SpellListKind, SpellSuggestResult } from "@/features/spellcheck/types";
import type { CueData, SubtitleFormat } from "@/features/subtitles/types";

/** False when the frontend runs in a plain browser via `pnpm dev`. */
export const inTauri = isTauri();

export interface BackupInfo {
  path: string;
  label: string;
  modifiedMs: number;
  size: number;
}

export interface MediaTrack {
  index: number;
  kind: string;
  codec: string | null;
  language: string | null;
  detail: string | null;
}

export interface MediaInfo {
  path: string;
  fileName: string;
  sizeBytes: number;
  modifiedMs: number | null;
  container: string | null;
  durationSecs: number | null;
  bitRate: number | null;
  width: number | null;
  height: number | null;
  frameRate: string | null;
  /** Average fps when parseable (TIM-07 / project fps). */
  fps: number | null;
  /** Container/stream start offset in seconds. */
  startTimeSecs: number | null;
  variableFrameRate: boolean | null;
  frameCount: number | null;
  tracks: MediaTrack[];
  source: string;
  note: string | null;
}

/** Mirrors `project::Project` in Rust: the `<name>.substudio.json` sidecar (FIL-03 / FIL-07). */
export interface ProjectFile {
  version?: number;
  videoPath: string | null;
  videoRelative?: string | null;
  fps: number | null;
  timecode: "frames" | "ms" | null;
  bookmarks: { index: number; start: number; note: string }[];
  selected: { index: number; start: number } | null;
  /** Last opened original/script file (FIL-07). */
  originalPath?: string | null;
  /** Per-cue original/script texts (FIL-07). */
  originals?: { index: number; start: number; text: string }[];
  /** Snapshot of the project's rule profile (RUL-01): `{ id, name, limits }`. Validated on the TS side. */
  ruleProfile?: unknown;
}

/** MED-02: source vs cached/encoded editing proxy for `<video>`. */
export interface PlaybackDecision {
  sourcePath: string;
  playbackPath: string;
  usingProxy: boolean;
  fromCache: boolean;
  reason: string | null;
}

/** Typed wrappers for the Rust commands in `src-tauri/src/lib.rs`. */
export const commands = {
  readSubtitles: (path: string) => invoke<CueData[]>("read_subtitles", { path }),
  /** Detects the encoding when the file isn't UTF-8 (FIL-04). */
  readSubtitlesDetect: (path: string) =>
    invoke<{ cues: CueData[]; encoding: string }>("read_subtitles_detect", { path }),
  readSubtitlesEncoded: (path: string, encoding: string) =>
    invoke<CueData[]>("read_subtitles_encoded", { path, encoding }),
  writeSubtitles: (path: string, cues: CueData[], format: SubtitleFormat) =>
    invoke<void>("write_subtitles", { path, cues, format }),
  /** Plain UTF-8 text (SCR-01 script import). */
  readTextFile: (path: string) => invoke<string>("read_text_file", { path }),
  readProject: (subtitlePath: string) => invoke<ProjectFile | null>("read_project", { subtitlePath }),
  writeProject: (subtitlePath: string, project: ProjectFile) =>
    invoke<void>("write_project", { subtitlePath, project }),
  fileMtime: (path: string) => invoke<number>("file_mtime", { path }),
  revealPath: (path: string) => invoke<void>("reveal_path", { path }),
  openPath: (path: string) => invoke<void>("open_path", { path }),
  listEncodings: () => invoke<string[]>("list_encodings"),
  appDataDir: () => invoke<string>("app_data_dir"),
  writeAutoBackup: (label: string, cues: CueData[], format: SubtitleFormat, keep?: number) =>
    invoke<string>("write_auto_backup", { label, cues, format, keep }),
  listAutoBackups: () => invoke<BackupInfo[]>("list_auto_backups"),
  ensureDataFolder: () => invoke<string>("ensure_data_folder"),
  probeMedia: (path: string) => invoke<MediaInfo>("probe_media", { path }),
  /** Source frame timestamps as SSFT `ArrayBuffer` (MED-01). */
  mediaFrameTimes: (path: string) => invoke<ArrayBuffer>("media_frame_times", { path }),
  /**
   * Resolve playback path (MED-02). Plays source when WebKit-safe; otherwise
   * builds/reuses an H.264 editing proxy. Progress is 0–1 while encoding.
   */
  ensurePlayback: (path: string, onProgress: Channel<number>) =>
    invoke<PlaybackDecision>("ensure_playback", { path, onProgress }),
  spellCheckTexts: (texts: string[], language: string, checkToneMarked?: boolean) =>
    invoke<SpellCheckResult>("spell_check_texts", { texts, language, checkToneMarked }),
  spellSuggest: (word: string, language: string) =>
    invoke<SpellSuggestResult>("spell_suggest", { word, language }),
  spellListWords: (kind: SpellListKind) => invoke<string[]>("spell_list_words", { kind }),
  spellAddWord: (kind: SpellListKind, word: string) => invoke<boolean>("spell_add_word", { kind, word }),
  spellRemoveWord: (kind: SpellListKind, word: string) => invoke<boolean>("spell_remove_word", { kind, word }),
};

export const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
export const stripExtension = (name: string) => name.replace(/\.[^.]+$/, "");
export const parentDir = (path: string) => {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i > 0 ? path.slice(0, i) : path;
};
