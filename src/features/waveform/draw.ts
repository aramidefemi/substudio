import { checkCue } from "@/features/subtitles/rules";
import { cueIndexAt } from "@/features/subtitles/store";
import type { Cue } from "@/features/subtitles/types";
import type { CanvasTokens } from "./tokens";

export const RULER_H = 20;

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
  tokens: CanvasTokens;
}

const noise = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Placeholder amplitude in 0..1 until Rust-computed peaks exist: louder
 * inside cues, near-silent between them.
 */
function sampleAmplitude(cues: readonly Cue[], t: number): number {
  const i = cueIndexAt(cues, t);
  const n = noise(Math.floor(t * 140));
  if (i < 0) return 0.03 + 0.05 * n;
  const c = cues[i]!;
  const env = Math.sin((Math.PI * (t - c.start)) / Math.max(0.01, c.end - c.start));
  return (0.25 + 0.75 * n) * (0.3 + 0.7 * Math.max(0, env)) * 0.9;
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
    ctx.fillStyle = s.selectedIds.has(c.id) ? k["cue-region-selected"] : k["cue-region"];
    ctx.fillRect(x(c.start), 0, x(c.end) - x(c.start), waveH);
  }

  // Waveform: one 2px column per sample, coloured by whether it falls in a cue.
  const paths = { a: new Path2D(), b: new Path2D(), sel: new Path2D() };
  for (let px = 0; px < w; px += 2) {
    const t = start + px / pps;
    const i = cueIndexAt(s.cues, t);
    const amp = Math.min(maxAmp, sampleAmplitude(s.cues, t) * ampScale * maxAmp);
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

  // Cue edges and labels.
  ctx.textBaseline = "alphabetic";
  for (const c of visible) {
    const i = s.cues.indexOf(c);
    const x0 = x(c.start);
    const x1 = x(c.end);
    const selected = s.selectedIds.has(c.id);
    const issues = checkCue(c, s.cues[i - 1]);
    ctx.strokeStyle = selected ? k["cue-edge-selected"] : k["cue-edge"];
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeRect(x0 + 0.5, 0.5, x1 - x0 - 1, waveH - 1);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 + 2, 0, Math.max(0, x1 - x0 - 4), waveH);
    ctx.clip();
    ctx.fillStyle = k["timeline-fg"];
    ctx.font = "500 12px 'Inter Variable', sans-serif";
    const label = s.hideText ? "••••" : (c.text.split("\n")[0] ?? "");
    ctx.fillText(label, x0 + 8, 18);
    ctx.font = "11px 'Inter Variable', sans-serif";
    ctx.fillStyle = issues.duration || issues.text ? k["cue-error"] : k["timeline-muted"];
    ctx.fillText(String(i + 1), x0 + 8, waveH - 8);
    ctx.restore();
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

  const px = x(s.time);
  if (px >= 0 && px <= w) {
    ctx.fillStyle = k["playhead"];
    ctx.fillRect(Math.round(px) - 1, 0, 2, waveH);
  }
}
