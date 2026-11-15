import { fileName, stripExtension } from "@/lib/tauri";

/** Rust rejects with this text when the user cancels (see `burn::CANCELLED`). */
export const BURN_CANCELLED = "Cancelled";

/** `film.mkv` → `film.burned.mp4` (never the source name, never overwrites it). */
export const burnedName = (videoPath: string) => `${stripExtension(fileName(videoPath))}.burned.mp4`;

/** Burn-in output is always MP4; add the extension when the dialog result lacks it. */
export const withMp4 = (path: string) => (/\.mp4$/i.test(path) ? path : `${path}.mp4`);

export const percent = (p: number) => `${Math.round(p * 100)}%`;
