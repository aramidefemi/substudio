import type { MediaTrack } from "@/lib/tauri";

/** How many numbered track commands appear in the Playback menu / palette. */
export const MAX_AUDIO_TRACK_SLOTS = 8;

/** Audio streams from a probe, in file order (ordinal 0 = first audio). */
export function listAudioTracks(tracks: readonly MediaTrack[]): MediaTrack[] {
  return tracks.filter((t) => t.kind === "audio");
}

/** Human label for a probe audio track (menu, media info, palette). */
export function audioTrackLabel(track: MediaTrack, ordinal: number): string {
  const parts = [`Track ${ordinal + 1}`];
  if (track.language) parts.push(track.language);
  if (track.codec) parts.push(track.codec);
  if (track.detail) parts.push(track.detail);
  return parts.join(" · ");
}

/** Clamp a preferred ordinal into `[0, count)`; empty list → 0. */
export function clampAudioOrdinal(count: number, preferred: number | null | undefined): number {
  if (count <= 0) return 0;
  if (preferred == null || !Number.isFinite(preferred)) return 0;
  const n = Math.trunc(preferred);
  if (n < 0) return 0;
  return Math.min(n, count - 1);
}

/** Wrap `current + delta` across available audio tracks. */
export function cycleAudioOrdinal(count: number, current: number, delta: number): number {
  if (count <= 0) return 0;
  const base = clampAudioOrdinal(count, current);
  return ((base + delta) % count + count) % count;
}

/** Sidecar / probe preference → usable ordinal for this file. */
export function resolveAudioTrack(
  tracks: readonly MediaTrack[],
  preferred: number | null | undefined,
): number {
  return clampAudioOrdinal(listAudioTracks(tracks).length, preferred);
}
