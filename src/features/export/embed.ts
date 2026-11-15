import { fileName, stripExtension } from "@/lib/tauri";
import { withExt } from "./burn";

/** Containers that can hold a soft subtitle track (see `mux::EXTENSIONS`; `.m4v` is accepted by Rust too). */
export const EMBED_EXTENSIONS = ["mp4", "mov", "mkv"] as const;

const extensionOf = (path: string) => fileName(path).split(".").pop()?.toLowerCase() ?? "";

/** Keep the source's container when it can hold subtitles, otherwise MP4. */
export const embedExtension = (videoPath: string) =>
  EMBED_EXTENSIONS.find((e) => e === extensionOf(videoPath)) ?? "mp4";

/** `film.mkv` → `film.subs.mkv` (never the source name, never overwrites it). */
export const embeddedName = (videoPath: string) =>
  `${stripExtension(fileName(videoPath))}.subs.${embedExtension(videoPath)}`;

export const withEmbedExt = (path: string, videoPath: string) =>
  withExt(path, EMBED_EXTENSIONS, embedExtension(videoPath));

/** Subtitle codec Rust wrote, as a person would say it. */
export const codecLabel = (codec: string) =>
  ({ mov_text: "mov_text track", srt: "SRT track", ass: "ASS track (styles kept)" })[codec] ?? codec;
