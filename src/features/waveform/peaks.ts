import { Channel, invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { inTauri } from "@/lib/tauri";

/** Loudest sample per bucket (0–255) at `rate` buckets per second. From `waveform.rs`. */
export interface Peaks {
  rate: number;
  values: Uint8Array;
}

interface PeaksState {
  path: string | null;
  audioTrack: number;
  status: "idle" | "loading" | "ready" | "error";
  /** 0–1 while loading. */
  progress: number;
  peaks: Peaks | null;
  error: string | null;
}

const IDLE: Omit<PeaksState, "path" | "audioTrack"> = {
  status: "idle",
  progress: 0,
  peaks: null,
  error: null,
};

export const usePeaks = create<PeaksState>()(() => ({ path: null, audioTrack: 0, ...IDLE }));

const HEADER_LEN = 17;

/** Parses `Peaks::to_bytes`: `SSPK` · version u8 · rate f64 LE · count u32 LE · values. */
export function parsePeaks(buffer: ArrayBuffer): Peaks | null {
  if (buffer.byteLength < HEADER_LEN) return null;
  const view = new DataView(buffer);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  if (magic !== "SSPK" || view.getUint8(4) !== 1) return null;
  const rate = view.getFloat64(5, true);
  const count = view.getUint32(13, true);
  if (HEADER_LEN + count > buffer.byteLength) return null;
  return { rate, values: new Uint8Array(buffer, HEADER_LEN, count) };
}

/** Loudest level (0–1) between `t0` and `t1` seconds, so zoomed-out views don't drop peaks. */
export function peakBetween(p: Peaks, t0: number, t1: number): number {
  const from = Math.max(0, Math.floor(t0 * p.rate));
  const to = Math.min(p.values.length, Math.max(from + 1, Math.ceil(t1 * p.rate)));
  let max = 0;
  for (let i = from; i < to; i++) if (p.values[i]! > max) max = p.values[i]!;
  return max / 255;
}

let generation = 0;

/** Loads (or reuses Rust's cached) peaks for a video + audio track; newer calls cancel older ones. */
export async function loadPeaks(path: string | null, audioTrack = 0) {
  const gen = ++generation;
  const track = Math.max(0, Math.trunc(audioTrack));
  if (!path || !inTauri) {
    usePeaks.setState({ path, audioTrack: track, ...IDLE });
    return;
  }
  usePeaks.setState({ path, audioTrack: track, ...IDLE, status: "loading" });
  const onProgress = new Channel<number>();
  onProgress.onmessage = (progress) => {
    if (gen === generation) usePeaks.setState({ progress });
  };
  try {
    const buffer = await invoke<ArrayBuffer>("waveform_peaks", {
      path,
      audioTrack: track,
      onProgress,
    });
    if (gen !== generation) return;
    const peaks = parsePeaks(buffer);
    usePeaks.setState(
      peaks
        ? { status: "ready", progress: 1, peaks, error: null }
        : { status: "error", peaks: null, error: "Unreadable waveform data" },
    );
  } catch (err) {
    if (gen === generation) usePeaks.setState({ status: "error", peaks: null, error: String(err) });
  }
}
