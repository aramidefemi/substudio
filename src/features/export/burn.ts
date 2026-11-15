import { fileName, stripExtension } from "@/lib/tauri";

/** Rust rejects with this text when the user cancels (see `ffmpeg_job::CANCELLED`). */
export const EXPORT_CANCELLED = "Cancelled";

/** `film.mkv` → `film.burned.mp4` (never the source name, never overwrites it). */
export const burnedName = (videoPath: string) => `${stripExtension(fileName(videoPath))}.burned.mp4`;

/** Keep `path` when it ends in one of `exts`, else append `fallback` (the dialog result can lack it). */
export const withExt = (path: string, exts: readonly string[], fallback: string) =>
  exts.some((e) => path.toLowerCase().endsWith(`.${e}`)) ? path : `${path}.${fallback}`;

/** Burn-in output is always MP4. */
export const withMp4 = (path: string) => withExt(path, ["mp4"], "mp4");

export const percent = (p: number) => `${Math.round(p * 100)}%`;
