import { checkCue } from "@/features/subtitles/rules";
import { cueIndexAt } from "@/features/subtitles/store";
import type { Cue } from "@/features/subtitles/types";
import { peakBetween, type Peaks } from "./peaks";
import type { CanvasTokens } from "./tokens";

export const RULER_H = 20;
/** Horizontal inset per side so adjacent cue cards show a visual gap. */
const CUE_INSET_X = 2;
/** Vertical inset so cards don't kiss the timeline edges. */
const CUE_INSET_Y = 1;

interface Scene {
  width: number;
  height: number;
  start: number;
  pps: number;
  /** Vertical scale for waveform amplitude (1 = default). */
  amp: number;
  time: number;
  cues: readonly Cue[];
  selectedIds: ReadonlySet<string>;
  hideText?: boolean;
  /** Marked region (drag on empty space), not yet a cue. */
  region?: { start: number; end: number } | null;
  /** Real audio peaks; null draws a flat line. */
  peaks: Peaks | null;
  /** Centred status text (no video, loading, error). */
  message: string | null;
  tokens: CanvasTokens;
}

export function drawWaveform(ctx: CanvasRenderingContext2D, s: Scene) {
  const { width: w, height: h, start, pps, amp: ampScale, tokens: k } = s;
  const end = start + w / pps;
  const waveH = h - RULER_H;
  const mid = waveH / 2;
  const maxAmp = mid - 6;
  const x = (t: number) => (t - start) * pps;
  const visible = s.cues.filter((c) => c.end >= start && c.start <= end);

  ctx.fillStyle = k["timeline-bg"];
  ctx.fillRect(0, 0, w, h);

  for (const c of visible) {
    const x0 = x(c.start) + CUE_INSET_X;
    const cw = Math.max(0, x(c.end) - x(c.start) - CUE_INSET_X * 2);
    ctx.fillStyle = s.selectedIds.has(c.id) ? k["cue-region-selected"] : k["cue-region"];
    ctx.fillRect(x0, CUE_INSET_Y, cw, Math.max(0, waveH - CUE_INSET_Y * 2));
  }

  // Waveform: one 2px column per peak range, coloured by whether it falls in a cue.
  const paths = { a: new Path2D(), b: new Path2D(), sel: new Path2D() };
  for (let px = 0; px < w; px += 2) {
    const t = start + px / pps;
    const i = cueIndexAt(s.cues, t);
    const level = s.peaks ? peakBetween(s.peaks, t, t + 2 / pps) : 0;
    const amp = Math.max(0.5, Math.min(maxAmp, level * ampScale * maxAmp));
    const path = i < 0 ? paths.a : s.selectedIds.has(s.cues[i]!.id) ? paths.sel : paths.b;
    path.moveTo(px + 0.5, mid - amp);
    path.lineTo(px + 0.5, mid + amp);
  }
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = k["waveform-a"];
  ctx.stroke(paths.a);
  ctx.strokeStyle = k["waveform-b"];
  ctx.stroke(paths.b);
  ctx.strokeStyle = k["waveform-selected"];
  ctx.stroke(paths.sel);

  // Cue labels (no border strokes — selection is fill + waveform colour).
  ctx.textBaseline = "alphabetic";
  for (const c of visible) {
    const i = s.cues.indexOf(c);
    const x0 = x(c.start) + CUE_INSET_X;
    const cw = Math.max(0, x(c.end) - x(c.start) - CUE_INSET_X * 2);
    const issues = checkCue(c, s.cues[i - 1]);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, CUE_INSET_Y, cw, Math.max(0, waveH - CUE_INSET_Y * 2));
    ctx.clip();
    ctx.fillStyle = k["timeline-fg"];
    ctx.font = "500 12px 'Inter Variable', sans-serif";
    const label = s.hideText ? "••••" : (c.text.split("\n")[0] ?? "");
    ctx.fillText(label, x0 + 6, 18);
    ctx.font = "11px 'Inter Variable', sans-serif";
    ctx.fillStyle = issues.duration || issues.text ? k["cue-error"] : k["timeline-muted"];
    ctx.fillText(String(i + 1), x0 + 6, waveH - 8);
    ctx.restore();
  }

  if (s.region && s.region.end >= start && s.region.start <= end) {
    const r0 = x(s.region.start);
    const r1 = x(s.region.end);
    ctx.fillStyle = k["wave-region"];
    ctx.fillRect(r0, 0, r1 - r0, waveH);
    ctx.fillStyle = k["wave-region-edge"];
    ctx.fillRect(Math.round(r0), 0, 1, waveH);
    ctx.fillRect(Math.round(r1) - 1, 0, 1, waveH);
  }

  // Ruler.
  const step = pps < 25 ? 10 : pps < 60 ? 5 : pps < 200 ? 2 : 1;
  ctx.fillStyle = k["timeline-muted"];
  ctx.font = "11px 'Inter Variable', sans-serif";
  for (let t = Math.ceil(start / step) * step; t <= end; t += step) {
    const rx = Math.round(x(t)) + 0.5;
    ctx.fillRect(rx, waveH, 1, 5);
    const m = Math.floor(t / 60);
    ctx.fillText(`${m}:${String(t % 60).padStart(2, "0")}`, rx + 3, h - 5);
  }

  if (s.message) {
    ctx.fillStyle = k["timeline-muted"];
    ctx.font = "12px 'Inter Variable', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(s.message, w / 2, mid + 4);
    ctx.textAlign = "start";
  }

  const px = x(s.time);
  if (px >= 0 && px <= w) {
    ctx.fillStyle = k["playhead"];
    ctx.fillRect(Math.round(px) - 1, 0, 2, waveH);
  }
}
