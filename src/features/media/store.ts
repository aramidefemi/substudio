import { Channel } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { create } from "zustand";
import type { MediaInfo, PlaybackDecision } from "@/lib/tauri";
import { commands, inTauri } from "@/lib/tauri";
import { listAudioTracks, resolveAudioTrack } from "./audioTracks";
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
  /** 0-based ordinal among audio streams (PLY-05). */
  audioTrack: number;
  loading: boolean;
  error: string | null;
}

export const useMedia = create<MediaState>(() => ({
  info: null,
  frameTimes: null,
  playbackPath: null,
  usingProxy: false,
  proxyProgress: null,
  audioTrack: 0,
  loading: false,
  error: null,
}));

const set = useMedia.setState;

/** Session preference per video path (survives re-open in the same run). */
const sessionAudioTrack = new Map<string, number>();

/** Clear probe + playback state when the video is closed. */
export function clearMedia() {
  set({
    info: null,
    frameTimes: null,
    playbackPath: null,
    usingProxy: false,
    proxyProgress: null,
    audioTrack: 0,
    loading: false,
    error: null,
  });
}

/**
 * Select an audio track by ordinal among audio streams. Persists for the current
 * video path for this session; project sidecar write captures it too.
 */
export function setAudioTrack(ordinal: number) {
  const { info } = useMedia.getState();
  const count = listAudioTracks(info?.tracks ?? []).length;
  const next = resolveAudioTrack(info?.tracks ?? [], ordinal);
  // Allow a preference before probe finishes (count 0 → keep floor(ordinal)).
  const preferred = count > 0 ? next : Math.max(0, Math.trunc(ordinal));
  if (info?.path) sessionAudioTrack.set(info.path, preferred);
  if (useMedia.getState().audioTrack !== preferred) set({ audioTrack: preferred });
}

/** Restore a sidecar/session preference for the open video (after probe or before). */
export function preferAudioTrack(path: string | null, ordinal: number | null | undefined) {
  if (path && ordinal != null && Number.isFinite(ordinal)) {
    sessionAudioTrack.set(path, Math.max(0, Math.trunc(ordinal)));
  }
  const { info } = useMedia.getState();
  if (info && path && info.path === path) {
    set({ audioTrack: resolveAudioTrack(info.tracks, sessionAudioTrack.get(path)) });
  } else if (ordinal != null && Number.isFinite(ordinal) && !info) {
    set({ audioTrack: Math.max(0, Math.trunc(ordinal)) });
  }
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
  const preferred = sessionAudioTrack.get(path) ?? 0;
  set({
    loading: true,
    error: null,
    info: null,
    frameTimes: null,
    playbackPath: null,
    usingProxy: false,
    proxyProgress: null,
    audioTrack: preferred,
  });
  try {
    const info = await commands.probeMedia(path);
    const audioTrack = resolveAudioTrack(info.tracks, sessionAudioTrack.get(path) ?? preferred);
    sessionAudioTrack.set(path, audioTrack);
    set({ info, audioTrack });
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
      audioTrack: preferred,
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
