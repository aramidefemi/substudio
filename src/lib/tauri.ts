import { invoke, isTauri } from "@tauri-apps/api/core";
import type { CueData, SubtitleFormat } from "@/features/subtitles/types";

/** False when the frontend runs in a plain browser via `pnpm dev`. */
export const inTauri = isTauri();

/** Typed wrappers for the Rust commands in `src-tauri/src/lib.rs`. */
export const commands = {
  readSubtitles: (path: string) => invoke<CueData[]>("read_subtitles", { path }),
  writeSubtitles: (path: string, cues: CueData[], format: SubtitleFormat) =>
    invoke<void>("write_subtitles", { path, cues, format }),
};

export const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
export const stripExtension = (name: string) => name.replace(/\.[^.]+$/, "");
