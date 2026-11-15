/** CSS colour tokens the canvas needs. Defined per theme in `src/styles/themes/*.css`. */
const NAMES = [
  "timeline-bg",
  "timeline-fg",
  "timeline-muted",
  "waveform-a",
  "waveform-b",
  "waveform-selected",
  "cue-region",
  "cue-region-selected",
  "cue-edge",
  "cue-edge-selected",
  "cue-error",
  "wave-region",
  "wave-region-edge",
  "playhead",
  "shot-change",
  "shot-change-zone",
] as const;

export type CanvasTokens = Record<(typeof NAMES)[number], string>;

let cache: CanvasTokens | null = null;

/** Reads tokens once and caches them; call `invalidateCanvasTokens` on theme change. */
export function canvasTokens(): CanvasTokens {
  if (!cache) {
    const style = getComputedStyle(document.documentElement);
    cache = Object.fromEntries(NAMES.map((n) => [n, style.getPropertyValue(`--${n}`).trim()])) as CanvasTokens;
  }
  return cache;
}

export function invalidateCanvasTokens() {
  cache = null;
}
