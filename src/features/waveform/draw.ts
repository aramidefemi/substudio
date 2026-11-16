import { GREEN_ZONE } from "@/features/media/shotChanges";
import { checkCue, type Rules } from "@/features/subtitles/rules";
import { cueIndexAt } from "@/features/subtitles/store";
import type { Cue } from "@/features/subtitles/types";
import { peakBetween, type Peaks } from "./peaks";
import { binBetween, type Spectrogram } from "./spectrogram";
import type { CanvasTokens } from "./tokens";
import type { WaveDisplay } from "./view";

export const RULER_H = 20;
/** Horizontal inset per side so adjacent cue cards show a visual gap. */
const CUE_INSET_X = 2;
/** Vertical inset so cards don't kiss the timeline edges. */
const CUE_INSET_Y = 1;

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Scene {
  width: number;
  height: number;
  start: number;
  pps: number;
  /** Vertical scale for waveform amplitude / spectrogram contrast (1 = default). */
  amp: number;
  time: number;
  cues: readonly Cue[];
  selectedIds: ReadonlySet<string>;
  hideText?: boolean;
  /** Marked region (drag on empty space), not yet a cue. */
  region?: { start: number; end: number } | null;
  /** Real audio peaks; null draws a flat line. */
  peaks: Peaks | null;
  spectrogram: Spectrogram | null;
  display: WaveDisplay;
  /** Shot-change timestamps (SYN-04); drawn as markers + green zones. */
  shotChanges?: ArrayLike<number> | null;
  /** Centred status text (no video, loading, error). */
  message: string | null;
  tokens: CanvasTokens;
  /** Active rule profile limits, for the error-coloured cue numbers. */
  rules: Rules;
}

/** Parse `#rgb` / `#rrggbb` / `rgb()` / `rgba()` from CSS tokens (no hard-coded palette). */
function parseCssColor(css: string): Rgb {
  const s = css.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0]! + hex[0]!, 16),
        g: parseInt(hex[1]! + hex[1]!, 16),
        b: parseInt(hex[2]! + hex[2]!, 16),
      };
    }
    return {
      r: parseInt(hex.slice(0, 2), 16) || 0,
      g: parseInt(hex.slice(2, 4), 16) || 0,
      b: parseInt(hex.slice(4, 6), 16) || 0,
    };
  }
  const m = s.match(/rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i);
  if (m) return { r: +m[1]!, g: +m[2]!, b: +m[3]! };
  return { r: 0, g: 0, b: 0 };
}

function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

/** Map 0–1 magnitude through low→mid→high token colours. */
function spectrogramColor(t: number, low: Rgb, mid: Rgb, high: Rgb): Rgb {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? lerpRgb(low, mid, x * 2) : lerpRgb(mid, high, (x - 0.5) * 2);
}

/** Offscreen spectrogram cache so playhead ticks don't rebuild every pixel. */
let specLayer: {
  key: string;
  canvas: OffscreenCanvas | HTMLCanvasElement;
} | null = null;

function paintSpectrogram(
  ctx: CanvasRenderingContext2D,
  s: Scene,
  waveH: number,
) {
  const { width: w, start, pps, amp, tokens: k, spectrogram: spec } = s;
  const dpr = ctx.getTransform().a || 1;
  const dw = Math.max(1, Math.round(w * dpr));
  const dh = Math.max(1, Math.round(waveH * dpr));
  const key = [
    start,
    pps,
    amp,
    dw,
    dh,
    k["spectrogram-low"],
    k["spectrogram-mid"],
    k["spectrogram-high"],
    spec ? `${spec.hopsPerSecond}:${spec.nBins}:${spec.values.length}:${spec.values[0]}:${spec.values[spec.values.length - 1]}` : "0",
  ].join("|");

  if (!specLayer || specLayer.key !== key || specLayer.canvas.width !== dw || specLayer.canvas.height !== dh) {
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(dw, dh)
        : Object.assign(document.createElement("canvas"), { width: dw, height: dh });
    canvas.width = dw;
    canvas.height = dh;
    const layer = canvas.getContext("2d")!;
    const low = parseCssColor(k["spectrogram-low"]);
    const midC = parseCssColor(k["spectrogram-mid"]);
    const high = parseCssColor(k["spectrogram-high"]);
    const bins = spec?.nBins ?? 1;
    const img = layer.createImageData(dw, dh);
    const data = img.data;
    // 2-device-px columns (matches waveform density) — fill pairs together.
    for (let px = 0; px < dw; px += 2) {
      const t0 = start + px / (pps * dpr);
      const t1 = t0 + 2 / (pps * dpr);
      for (let py = 0; py < dh; py++) {
        // Low frequencies at the bottom (speech-editing convention).
        const bin = Math.min(bins - 1, Math.floor(((dh - 1 - py) / dh) * bins));
        let level = spec ? binBetween(spec, bin, t0, t1) : 0;
        level = Math.max(0, Math.min(1, level * amp));
        const c = spectrogramColor(level, low, midC, high);
        for (let dx = 0; dx < 2 && px + dx < dw; dx++) {
          const i = (py * dw + px + dx) * 4;
          data[i] = c.r;
          data[i + 1] = c.g;
          data[i + 2] = c.b;
          data[i + 3] = 255;
        }
      }
    }
    layer.putImageData(img, 0, 0);
    specLayer = { key, canvas };
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(specLayer.canvas, 0, 0);
  ctx.restore();
}

export function drawWaveform(ctx: CanvasRenderingContext2D, s: Scene) {
  const { width: w, height: h, start, pps, amp: ampScale, tokens: k } = s;
  const end = start + w / pps;
  const waveH = h - RULER_H;
  const mid = waveH / 2;
  const maxAmp = mid - 6;
  const x = (t: number) => (t - start) * pps;
  const visible = s.cues.filter((c) => !c.untimed && c.end >= start && c.start <= end);

  ctx.fillStyle = k["timeline-bg"];
  ctx.fillRect(0, 0, w, h);

  if (s.display === "spectrogram") {
    paintSpectrogram(ctx, s, waveH);
  }

  // Shot-change green zones + ticks (under cues so regions stay readable).
  const shots = s.shotChanges;
  if (shots && shots.length) {
    const zone = GREEN_ZONE;
    for (let i = 0; i < shots.length; i++) {
      const t = shots[i]!;
      if (t + zone < start || t - zone > end) continue;
      const x0 = x(t - zone);
      const x1 = x(t + zone);
      ctx.fillStyle = k["shot-change-zone"];
      ctx.fillRect(x0, 0, Math.max(1, x1 - x0), waveH);
    }
    ctx.fillStyle = k["shot-change"];
    for (let i = 0; i < shots.length; i++) {
      const t = shots[i]!;
      if (t < start || t > end) continue;
      ctx.fillRect(Math.round(x(t)), 0, 1, waveH);
    }
  }

  for (const c of visible) {
    const x0 = x(c.start) + CUE_INSET_X;
    const cw = Math.max(0, x(c.end) - x(c.start) - CUE_INSET_X * 2);
    ctx.fillStyle = s.selectedIds.has(c.id) ? k["cue-region-selected"] : k["cue-region"];
    ctx.fillRect(x0, CUE_INSET_Y, cw, Math.max(0, waveH - CUE_INSET_Y * 2));
  }

  if (s.display === "waveform") {
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
  }

  // Cue labels (no border strokes — selection is fill + waveform colour).
  ctx.textBaseline = "alphabetic";
  for (const c of visible) {
    const i = s.cues.indexOf(c);
    const x0 = x(c.start) + CUE_INSET_X;
    const cw = Math.max(0, x(c.end) - x(c.start) - CUE_INSET_X * 2);
    const issues = checkCue(c, s.cues[i - 1], s.rules);

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
