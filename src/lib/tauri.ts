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

/** Typed wrappers for the Rust commands in `src-tauri/src/lib.rs`. */
export const commands = {
  readSubtitles: (path: string) => invoke<CueData[]>("read_subtitles", { path }),
  readSubtitlesEncoded: (path: string, encoding: string) =>
    invoke<CueData[]>("read_subtitles_encoded", { path, encoding }),
  writeSubtitles: (path: string, cues: CueData[], format: SubtitleFormat) =>
    invoke<void>("write_subtitles", { path, cues, format }),
  fileMtime: (path: string) => invoke<number>("file_mtime", { path }),
  revealPath: (path: string) => invoke<void>("reveal_path", { path }),
  openPath: (path: string) => invoke<void>("open_path", { path }),
  listEncodings: () => invoke<string[]>("list_encodings"),
  appDataDir: () => invoke<string>("app_data_dir"),
  writeAutoBackup: (label: string, cues: CueData[], format: SubtitleFormat, keep?: number) =>
    invoke<string>("write_auto_backup", { label, cues, format, keep }),
  listAutoBackups: () => invoke<BackupInfo[]>("list_auto_backups"),
  ensureDataFolder: () => invoke<string>("ensure_data_folder"),
};

export const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
export const stripExtension = (name: string) => name.replace(/\.[^.]+$/, "");
export const parentDir = (path: string) => {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i > 0 ? path.slice(0, i) : path;
};
