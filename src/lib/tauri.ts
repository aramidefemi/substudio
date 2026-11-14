import { invoke, isTauri } from "@tauri-apps/api/core";
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
  tracks: MediaTrack[];
  source: string;
  note: string | null;
}

/** Mirrors `project::Project` in Rust: the `<name>.substudio.json` sidecar (FIL-03). */
export interface ProjectFile {
  version?: number;
  videoPath: string | null;
  videoRelative?: string | null;
  fps: number | null;
  timecode: "frames" | "ms" | null;
  bookmarks: { index: number; start: number; note: string }[];
  selected: { index: number; start: number } | null;
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
};

export const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
export const stripExtension = (name: string) => name.replace(/\.[^.]+$/, "");
export const parentDir = (path: string) => {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i > 0 ? path.slice(0, i) : path;
};
