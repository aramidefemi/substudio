import { fileName, parentDir, stripExtension } from "@/lib/tauri";
import type { SubtitleFormat } from "@/features/subtitles/types";

export interface BatchFailure {
  path: string;
  error: string;
}

/** Mirrors `batch::BatchOutcome` in Rust. */
export interface BatchOutcome {
  ok: string[];
  failed: BatchFailure[];
}

/** Mirrors `batch::BatchProgress` in Rust. */
export interface BatchProgress {
  done: number;
  total: number;
  name: string;
}

export const BATCH_FORMATS: { value: SubtitleFormat; label: string }[] = [
  { value: "srt", label: "SubRip (.srt)" },
  { value: "vtt", label: "WebVTT (.vtt)" },
  { value: "ass", label: "ASS (.ass)" },
  { value: "ssa", label: "SSA (.ssa)" },
  { value: "sbv", label: "YouTube SBV (.sbv)" },
  { value: "ttml", label: "TTML (.ttml)" },
  { value: "dfxp", label: "DFXP (.dfxp)" },
];

/** `/in/Film.vtt` → `Film.srt`. The format name is its extension. */
export const convertedName = (path: string, format: SubtitleFormat) =>
  `${stripExtension(fileName(path))}.${format}`;

/** Suggested output folder: `converted` beside the first input. */
export const defaultOutDir = (paths: readonly string[]) =>
  paths.length ? `${parentDir(paths[0]!)}/converted` : "";

/** Offset field in whole milliseconds: blank is 0, anything else non-integer is invalid (`null`). */
export function parseOffsetMs(text: string): number | null {
  const t = text.trim();
  return t === "" ? 0 : /^[+-]?\d+$/.test(t) ? Number(t) : null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Toast title for a finished batch. */
export const batchSummary = ({ ok, failed }: BatchOutcome) =>
  failed.length
    ? `Converted ${ok.length}, ${failed.length} failed`
    : `Converted ${plural(ok.length, "file")}`;

/** Merge newly picked paths into the list, keeping order and dropping repeats. */
export const mergePaths = (current: readonly string[], added: readonly string[]) => [
  ...new Set([...current, ...added]),
];
