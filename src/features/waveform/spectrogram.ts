import { Channel, invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { inTauri } from "@/lib/tauri";

/** STFT magnitudes from `spectrogram.rs`: hops × nBins, u8 log-magnitude. */
export interface Spectrogram {
  hopsPerSecond: number;
  nBins: number;
  values: Uint8Array;
}

interface SpectrogramState {
  path: string | null;
  audioTrack: number;
  status: "idle" | "loading" | "ready" | "error";
  progress: number;
  spectrogram: Spectrogram | null;
  error: string | null;
}

const IDLE: Omit<SpectrogramState, "path" | "audioTrack"> = {
  status: "idle",
  progress: 0,
  spectrogram: null,
  error: null,
};

export const useSpectrogram = create<SpectrogramState>()(() => ({
  path: null,
  audioTrack: 0,
  ...IDLE,
}));

/** magic(4) + ver(1) + hops f64(8) + nBins u16(2) + hopCount u32(4) */
const HEADER_LEN = 19;

/** Parses `Spectrogram::to_bytes`: `SSPC` · version · hops/s · n_bins · hop_count · values. */
export function parseSpectrogram(buffer: ArrayBuffer): Spectrogram | null {
  if (buffer.byteLength < HEADER_LEN) return null;
  const view = new DataView(buffer);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  if (magic !== "SSPC" || view.getUint8(4) !== 1) return null;
  const hopsPerSecond = view.getFloat64(5, true);
  const nBins = view.getUint16(13, true);
  const hopCount = view.getUint32(15, true);
  const need = hopCount * nBins;
  if (HEADER_LEN + need > buffer.byteLength) return null;
  return { hopsPerSecond, nBins, values: new Uint8Array(buffer, HEADER_LEN, need) };
}

/** Max magnitude (0–1) in frequency bin `bin` between `t0` and `t1`. */
export function binBetween(s: Spectrogram, bin: number, t0: number, t1: number): number {
  if (bin < 0 || bin >= s.nBins) return 0;
  const from = Math.max(0, Math.floor(t0 * s.hopsPerSecond));
  const hops = Math.floor(s.values.length / s.nBins);
  const to = Math.min(hops, Math.max(from + 1, Math.ceil(t1 * s.hopsPerSecond)));
  let max = 0;
  for (let h = from; h < to; h++) {
    const v = s.values[h * s.nBins + bin]!;
    if (v > max) max = v;
  }
  return max / 255;
}

let generation = 0;

/** Loads (or reuses Rust's cached) spectrogram; newer calls cancel older ones. */
export async function loadSpectrogram(path: string | null, audioTrack = 0) {
  const gen = ++generation;
  const track = Math.max(0, Math.trunc(audioTrack));
  if (!path || !inTauri) {
    useSpectrogram.setState({ path, audioTrack: track, ...IDLE });
    return;
  }
  const cur = useSpectrogram.getState();
  if (cur.path === path && cur.audioTrack === track && cur.status === "ready" && cur.spectrogram) {
    return;
  }
  useSpectrogram.setState({ path, audioTrack: track, ...IDLE, status: "loading" });
  const onProgress = new Channel<number>();
  onProgress.onmessage = (progress) => {
    if (gen === generation) useSpectrogram.setState({ progress });
  };
  try {
    const buffer = await invoke<ArrayBuffer>("waveform_spectrogram", {
      path,
      audioTrack: track,
      onProgress,
    });
    if (gen !== generation) return;
    const spectrogram = parseSpectrogram(buffer);
    useSpectrogram.setState(
      spectrogram
        ? { status: "ready", progress: 1, spectrogram, error: null }
        : { status: "error", spectrogram: null, error: "Unreadable spectrogram data" },
    );
  } catch (err) {
    if (gen === generation) {
      useSpectrogram.setState({ status: "error", spectrogram: null, error: String(err) });
    }
  }
}
