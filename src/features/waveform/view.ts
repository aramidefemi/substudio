import { create } from "zustand";

/** Visible window of the timeline: first visible second and zoom (pixels per second). */
export const useWaveView = create<{ start: number; pps: number }>()(() => ({ start: 0, pps: 120 }));

export const DEFAULT_PPS = 120;
export const MIN_PPS = 10;
export const MAX_PPS = 600;

export function setZoom(pps: number, anchorX = 0) {
  const { start, pps: old } = useWaveView.getState();
  const next = Math.max(MIN_PPS, Math.min(MAX_PPS, pps));
  // Keep the time under `anchorX` fixed while zooming.
  const anchorT = start + anchorX / old;
  useWaveView.setState({ pps: next, start: Math.max(0, anchorT - anchorX / next) });
}

export function scrollBy(seconds: number) {
  useWaveView.setState((s) => ({ start: Math.max(0, s.start + seconds) }));
}
