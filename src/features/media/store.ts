import { create } from "zustand";
import type { MediaInfo } from "@/lib/tauri";
import { commands, inTauri } from "@/lib/tauri";
import { parseFrameTimes } from "./frameTimes";

export interface MediaState {
  info: MediaInfo | null;
  /** Source display-frame timestamps in seconds; null until loaded or unavailable. */
  frameTimes: Float64Array | null;
  loading: boolean;
  error: string | null;
}

export const useMedia = create<MediaState>(() => ({
  info: null,
  frameTimes: null,
  loading: false,
  error: null,
}));

const set = useMedia.setState;

/** Clear probe state when the video is closed. */
export function clearMedia() {
  set({ info: null, frameTimes: null, loading: false, error: null });
}

/**
 * Probe the open video and load cached frame timestamps (MED-01).
 * Returns the info so callers can adopt fps (TIM-07).
 */
export async function loadMedia(path: string | null): Promise<MediaInfo | null> {
  if (!path || !inTauri) {
    clearMedia();
    return null;
  }
  set({ loading: true, error: null, info: null, frameTimes: null });
  try {
    const info = await commands.probeMedia(path);
    set({ info });
    try {
      const buf = await commands.mediaFrameTimes(path);
      set({ frameTimes: parseFrameTimes(buf) });
    } catch {
      // Probe still useful without timestamps (mdls / no ffprobe).
      set({ frameTimes: null });
    }
    set({ loading: false });
    return info;
  } catch (err) {
    set({ loading: false, error: String(err), info: null, frameTimes: null });
    return null;
  }
}
