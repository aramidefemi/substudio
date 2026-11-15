import { Channel } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { create } from "zustand";
import type { MediaInfo, PlaybackDecision } from "@/lib/tauri";
import { commands, inTauri } from "@/lib/tauri";
import { parseFrameTimes } from "./frameTimes";

export interface MediaState {
  info: MediaInfo | null;
  /** Source display-frame timestamps in seconds; null until loaded or unavailable. */
  frameTimes: Float64Array | null;
  /** Path for `<video src>` — source or editing proxy. Null until resolved. */
  playbackPath: string | null;
  usingProxy: boolean;
  /** 0–1 while encoding a proxy; null when idle. */
  proxyProgress: number | null;
  loading: boolean;
  error: string | null;
}

export const useMedia = create<MediaState>(() => ({
  info: null,
  frameTimes: null,
  playbackPath: null,
  usingProxy: false,
  proxyProgress: null,
  loading: false,
  error: null,
}));

const set = useMedia.setState;

/** Clear probe + playback state when the video is closed. */
export function clearMedia() {
  set({
    info: null,
    frameTimes: null,
    playbackPath: null,
    usingProxy: false,
    proxyProgress: null,
    loading: false,
    error: null,
  });
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
  set({
    loading: true,
    error: null,
    info: null,
    frameTimes: null,
    playbackPath: null,
    usingProxy: false,
    proxyProgress: null,
  });
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
    set({
      loading: false,
      error: String(err),
      info: null,
      frameTimes: null,
      playbackPath: null,
      usingProxy: false,
      proxyProgress: null,
    });
    return null;
  }
}

let playbackGen = 0;

/**
 * Resolve `<video>` path: WebKit-safe source, or cached/encoded editing proxy (MED-02).
 * Source `videoPath` in the subtitle store is unchanged — subtitle times stay on the source timeline.
 */
export async function ensurePlayback(path: string | null): Promise<PlaybackDecision | null> {
  const gen = ++playbackGen;
  if (!path || !inTauri) {
    if (gen === playbackGen) {
      set({ playbackPath: null, usingProxy: false, proxyProgress: null });
    }
    return null;
  }

  set({ proxyProgress: 0, playbackPath: null, usingProxy: false });
  const onProgress = new Channel<number>();
  let toastShown = false;
  onProgress.onmessage = (p) => {
    if (gen !== playbackGen) return;
    set({ proxyProgress: p });
    if (!toastShown && p > 0 && p < 1) {
      toastShown = true;
      toast.loading("Creating editing proxy…", { id: "editing-proxy" });
    }
  };

  try {
    const decision = await commands.ensurePlayback(path, onProgress);
    if (gen !== playbackGen) return null;
    set({
      playbackPath: decision.playbackPath,
      usingProxy: decision.usingProxy,
      proxyProgress: null,
    });
    if (toastShown) {
      toast.success(decision.fromCache ? "Editing proxy ready" : "Editing proxy created", {
        id: "editing-proxy",
        description: decision.reason ?? undefined,
      });
    } else if (decision.usingProxy && decision.fromCache) {
      // Silent reuse — no toast noise on reopen.
    }
    return decision;
  } catch (err) {
    if (gen !== playbackGen) return null;
    set({ playbackPath: path, usingProxy: false, proxyProgress: null });
    toast.error("Could not prepare playback", {
      id: "editing-proxy",
      description: String(err),
    });
    return null;
  }
}
