import { create } from "zustand";

export type WaveDisplay = "waveform" | "spectrogram";

/** Visible window of the timeline: start time, horizontal zoom, vertical (amplitude) zoom. */
export const useWaveView = create<{
  start: number;
  pps: number;
  amp: number;
  /** Waveform ↔ spectrogram (WAV-08); session-only, not persisted. */
  display: WaveDisplay;
}>()(() => ({
  start: 0,
  pps: 120,
  amp: 1,
  display: "waveform",
}));

export const DEFAULT_PPS = 120;
export const MIN_PPS = 10;
export const MAX_PPS = 600;

export const DEFAULT_AMP = 1;
export const MIN_AMP = 0.25;
export const MAX_AMP = 4;

export function setWaveDisplay(display: WaveDisplay) {
  useWaveView.setState({ display });
}

export function toggleWaveDisplay() {
  useWaveView.setState((s) => ({
    display: s.display === "waveform" ? "spectrogram" : "waveform",
  }));
}

export function setZoom(pps: number, anchorX = 0) {
  const { start, pps: old } = useWaveView.getState();
  const next = Math.max(MIN_PPS, Math.min(MAX_PPS, pps));
  // Keep the time under `anchorX` fixed while zooming.
  const anchorT = start + anchorX / old;
  useWaveView.setState({ pps: next, start: Math.max(0, anchorT - anchorX / next) });
}

/** Vertical zoom: scales waveform amplitude (1 = default). */
export function setAmplitude(amp: number) {
  useWaveView.setState({ amp: Math.max(MIN_AMP, Math.min(MAX_AMP, amp)) });
}

export function scrollBy(seconds: number) {
  useWaveView.setState((s) => ({ start: Math.max(0, s.start + seconds) }));
}

/** Scroll so `time` sits at `fraction` of the visible width (0.5 = centre). */
export function centerOn(time: number, widthPx: number, fraction = 0.5) {
  const { pps } = useWaveView.getState();
  if (widthPx <= 0 || pps <= 0) return;
  useWaveView.setState({ start: Math.max(0, time - (widthPx * fraction) / pps) });
}

/** Restore default horizontal + vertical zoom; optionally keep current scroll. */
export function resetZoom(opts?: { centerTime?: number; widthPx?: number }) {
  const pps = DEFAULT_PPS;
  const amp = DEFAULT_AMP;
  if (opts?.centerTime != null && opts.widthPx != null && opts.widthPx > 0) {
    useWaveView.setState({
      pps,
      amp,
      start: Math.max(0, opts.centerTime - (opts.widthPx * 0.5) / pps),
    });
    return;
  }
  useWaveView.setState({ pps, amp });
}
