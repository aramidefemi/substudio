export type TimecodeMode = "frames" | "ms";

export interface TimeFormat {
  mode: TimecodeMode;
  fps: number;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");
const hms = (s: number) =>
  `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

/** Splits seconds into whole seconds and a frame index within that second. */
function toFrames(t: number, fps: number): [number, number] {
  const nominal = Math.round(fps);
  let secs = Math.floor(t + 1e-9);
  let frame = Math.round((t - secs) * fps);
  if (frame >= nominal) {
    secs += 1;
    frame = 0;
  }
  return [secs, frame];
}

/** `hh:mm:ss:ff` in frames mode, `hh:mm:ss,mmm` in milliseconds mode. */
export function formatTime(t: number, { mode, fps }: TimeFormat): string {
  t = Math.max(0, t);
  if (mode === "frames") {
    const [s, f] = toFrames(t, fps);
    return `${hms(s)}:${pad(f)}`;
  }
  const ms = Math.round(t * 1000);
  return `${hms(Math.floor(ms / 1000))},${pad(ms % 1000, 3)}`;
}

/** `s:ff` in frames mode (Subtitle Edit style), `s,mmm` in milliseconds mode. */
export function formatDuration(d: number, { mode, fps }: TimeFormat): string {
  d = Math.max(0, d);
  if (mode === "frames") {
    const [s, f] = toFrames(d, fps);
    return `${s}:${pad(f)}`;
  }
  return (Math.round(d * 1000) / 1000).toFixed(3).replace(".", ",");
}

const TIME_RE = /^(\d+):(\d{1,2}):(\d{1,2})([,.:])(\d{1,3})$/;

/** Accepts either format regardless of the current display mode. */
export function parseTime(input: string, { fps }: TimeFormat): number | null {
  const m = TIME_RE.exec(input.trim());
  if (!m) return null;
  const [, h, min, s, sep, frac = ""] = m;
  const base = Number(h) * 3600 + Number(min) * 60 + Number(s);
  if (sep === ":") return Number(frac) < Math.round(fps) ? base + Number(frac) / fps : null;
  return base + Number(frac.padEnd(3, "0")) / 1000;
}

export function parseDuration(input: string, { fps }: TimeFormat): number | null {
  const s = input.trim();
  const frames = /^(\d+):(\d{1,2})$/.exec(s);
  if (frames) return Number(frames[1]) + Number(frames[2]) / fps;
  if (!/^\d+([,.]\d+)?$/.test(s)) return null;
  return Number(s.replace(",", "."));
}

/** One arrow-key nudge: a frame, or 10 ms. */
export const nudgeStep = ({ mode, fps }: TimeFormat) => (mode === "frames" ? 1 / fps : 0.01);
