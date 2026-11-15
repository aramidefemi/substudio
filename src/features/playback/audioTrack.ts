import { clampAudioOrdinal } from "@/features/media/audioTracks";

/**
 * Enable the selected audio stream on a media element when the browser exposes
 * `audioTracks` (WebKit does for many multi-track files). Returns false when
 * the API is missing or empty — waveform still follows the Rust-side selection.
 */
export function applyMediaAudioTrack(video: HTMLVideoElement | null, ordinal: number): boolean {
  const list = video?.audioTracks;
  if (!list || list.length === 0) return false;
  const i = clampAudioOrdinal(list.length, ordinal);
  let changed = false;
  for (let n = 0; n < list.length; n++) {
    const track = list[n]!;
    const enable = n === i;
    if (track.enabled !== enable) {
      track.enabled = enable;
      changed = true;
    }
  }
  return changed;
}
