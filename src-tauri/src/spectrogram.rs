//! Spectrogram (STFT magnitudes) from the same mono decode path as waveform peaks.
//!
//! Cached next to peaks as `.sspc`. Sent to the UI as raw bytes; drawn on canvas.

use std::fs;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::UNIX_EPOCH;

use rustfft::num_complex::Complex;
use rustfft::FftPlanner;

use crate::waveform::for_each_mono_frame;

/// Hops per second of spectrogram columns.
pub const HOPS_PER_SECOND: u32 = 50;
/// FFT size (power of two). Positive bins = FFT_SIZE/2.
pub const FFT_SIZE: usize = 512;
/// Frequency bins kept (low end — speech-focused).
pub const N_BINS: usize = 64;
/// ffmpeg resample rate when Symphonia can't decode the codec.
const FFMPEG_RATE: u32 = 16_000;

const MAGIC: &[u8; 4] = b"SSPC";
const VERSION: u8 = 1;
/// magic + ver + hops_per_sec f64 + n_bins u16 + hop_count u32
const HEADER_LEN: usize = 4 + 1 + 8 + 2 + 4;

#[derive(Debug, PartialEq)]
pub struct Spectrogram {
    pub hops_per_second: f64,
    pub n_bins: u16,
    /// Row-major: hop * n_bins + bin (bin 0 = lowest frequency), u8 log-magnitude.
    pub values: Vec<u8>,
}

impl Spectrogram {
    /// `SSPC` · version · hops_per_sec f64 LE · n_bins u16 LE · hop_count u32 LE · values.
    pub fn to_bytes(&self) -> Vec<u8> {
        let hops = self.values.len() / self.n_bins.max(1) as usize;
        let mut out = Vec::with_capacity(HEADER_LEN + self.values.len());
        out.extend_from_slice(MAGIC);
        out.push(VERSION);
        out.extend_from_slice(&self.hops_per_second.to_le_bytes());
        out.extend_from_slice(&self.n_bins.to_le_bytes());
        out.extend_from_slice(&(hops as u32).to_le_bytes());
        out.extend_from_slice(&self.values);
        out
    }

    pub fn from_bytes(bytes: &[u8]) -> Option<Spectrogram> {
        if bytes.len() < HEADER_LEN || &bytes[0..4] != MAGIC || bytes[4] != VERSION {
            return None;
        }
        let hops_per_second = f64::from_le_bytes(bytes[5..13].try_into().ok()?);
        let n_bins = u16::from_le_bytes(bytes[13..15].try_into().ok()?);
        let hop_count = u32::from_le_bytes(bytes[15..19].try_into().ok()?) as usize;
        let need = hop_count * n_bins as usize;
        let values = bytes.get(HEADER_LEN..HEADER_LEN + need)?.to_vec();
        Some(Spectrogram { hops_per_second, n_bins, values })
    }
}

struct SpecBuilder {
    hop: usize,
    window: Vec<f32>,
    /// Current FFT window.
    buf: Vec<f32>,
    /// Samples waiting to slide the window by `hop`.
    pending: Vec<f32>,
    primed: bool,
    fft: Arc<dyn rustfft::Fft<f32>>,
    scratch: Vec<Complex<f32>>,
    hops_per_second: f64,
    values: Vec<u8>,
    peak_mag: f32,
    mags: Vec<f32>,
}

impl SpecBuilder {
    fn new(sample_rate: u32) -> Self {
        // Keep hop ≤ FFT/2 so the sliding window always fits (48 kHz → 960 > 512).
        let hop = ((sample_rate / HOPS_PER_SECOND) as usize)
            .clamp(1, FFT_SIZE / 2);
        let hops_per_second = sample_rate as f64 / hop as f64;
        let window: Vec<f32> = (0..FFT_SIZE)
            .map(|i| {
                let x = std::f32::consts::PI * i as f32 / (FFT_SIZE as f32 - 1.0);
                0.5 - 0.5 * (2.0 * x).cos() // Hann
            })
            .collect();
        let mut planner = FftPlanner::<f32>::new();
        let fft = planner.plan_fft_forward(FFT_SIZE);
        Self {
            hop,
            window,
            buf: Vec::with_capacity(FFT_SIZE),
            pending: Vec::with_capacity(hop),
            primed: false,
            fft,
            scratch: vec![Complex::new(0.0, 0.0); FFT_SIZE],
            hops_per_second,
            values: Vec::new(),
            peak_mag: 1e-9,
            mags: Vec::new(),
        }
    }

    fn push(&mut self, sample: f32) {
        if !self.primed {
            self.buf.push(sample);
            if self.buf.len() == FFT_SIZE {
                self.emit_hop();
                self.primed = true;
            }
            return;
        }
        self.pending.push(sample);
        while self.pending.len() >= self.hop {
            self.buf.copy_within(self.hop..FFT_SIZE, 0);
            self.buf[FFT_SIZE - self.hop..].copy_from_slice(&self.pending[..self.hop]);
            self.pending.drain(..self.hop);
            self.emit_hop();
        }
    }

    fn emit_hop(&mut self) {
        for i in 0..FFT_SIZE {
            self.scratch[i] = Complex::new(self.buf[i] * self.window[i], 0.0);
        }
        self.fft.process(&mut self.scratch);
        for b in 0..N_BINS {
            let c = self.scratch[b + 1]; // skip DC; bins 1..=N_BINS
            let mag = (c.re * c.re + c.im * c.im).sqrt();
            self.peak_mag = self.peak_mag.max(mag);
            self.mags.push(mag);
        }
    }

    fn finish(mut self) -> Spectrogram {
        if !self.primed && !self.buf.is_empty() {
            self.buf.resize(FFT_SIZE, 0.0);
            self.emit_hop();
        }
        let peak = self.peak_mag.max(1e-9);
        const MIN_DB: f32 = -80.0;
        self.values.reserve(self.mags.len());
        for mag in self.mags {
            let db = 20.0 * (mag / peak).max(1e-10).log10();
            let t = ((db - MIN_DB) / -MIN_DB).clamp(0.0, 1.0);
            self.values.push((t * 255.0).round() as u8);
        }
        Spectrogram {
            hops_per_second: self.hops_per_second,
            n_bins: N_BINS as u16,
            values: self.values,
        }
    }
}

/// Decode + STFT for `audio_track`. `progress` is 0–1.
pub fn compute(path: &Path, audio_track: u32, mut progress: impl FnMut(f32)) -> Result<Spectrogram, String> {
    let mut builder: Option<SpecBuilder> = None;
    for_each_mono_frame(path, audio_track, FFMPEG_RATE, &mut progress, &mut |rate, s| {
        builder.get_or_insert_with(|| SpecBuilder::new(rate)).push(s);
    })?;
    let builder = builder.ok_or_else(|| "No audio samples decoded".to_string())?;
    let spec = builder.finish();
    if spec.values.is_empty() {
        return Err("No spectrogram hops decoded".into());
    }
    Ok(spec)
}

fn cache_file(path: &Path, cache_dir: &Path, audio_track: u32) -> Result<PathBuf, String> {
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let mut h = DefaultHasher::new();
    (path, meta.len(), mtime, VERSION, audio_track, HOPS_PER_SECOND, FFT_SIZE as u32, N_BINS as u32).hash(&mut h);
    Ok(cache_dir.join("spectrograms").join(format!("{:016x}.sspc", h.finish())))
}

/// Cached spectrogram bytes for `path` / `audio_track`.
pub fn load_or_compute(
    path: &str,
    cache_dir: &Path,
    audio_track: u32,
    mut progress: impl FnMut(f32),
) -> Result<Vec<u8>, String> {
    let media = Path::new(path);
    let cached = cache_file(media, cache_dir, audio_track)?;
    if let Ok(bytes) = fs::read(&cached) {
        if Spectrogram::from_bytes(&bytes).is_some() {
            progress(1.0);
            return Ok(bytes);
        }
    }
    let bytes = compute(media, audio_track, &mut progress)?.to_bytes();
    if let Some(dir) = cached.parent() {
        let _ = fs::create_dir_all(dir).and_then(|_| fs::write(&cached, &bytes));
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::waveform::tests::{temp_dir, write_sine_wav, write_wav};

    #[test]
    fn bytes_round_trip() {
        let s = Spectrogram {
            hops_per_second: 50.0,
            n_bins: 64,
            values: vec![0, 7, 255, 10],
        };
        // pad to hop * n_bins
        let mut s = s;
        s.values.resize(64, 0);
        assert_eq!(Spectrogram::from_bytes(&s.to_bytes()), Some(s));
        assert_eq!(Spectrogram::from_bytes(b"nope"), None);
    }

    #[test]
    fn sine_lights_expected_band() {
        let dir = temp_dir("spec-sine");
        let wav = dir.join("440.wav");
        write_sine_wav(&wav, 16_000, 1, 440.0);
        let spec = compute(&wav, 0, |_| {}).unwrap();
        // 16 kHz → hop clamped to FFT/2 → ~62.5 hops/s
        assert!((spec.hops_per_second - 62.5).abs() < 1.0);
        assert_eq!(spec.n_bins, N_BINS as u16);
        assert!(spec.values.len() >= N_BINS);

        // Bin for 440 Hz: bin k ≈ freq * FFT_SIZE / rate; we store bin index k-1 (skipped DC).
        // 440 * 512 / 16000 ≈ 14.08 → scratch[14] → values index 13.
        let target = 13usize;
        let hops = spec.values.len() / N_BINS;
        let mid = hops / 2;
        let row = &spec.values[mid * N_BINS..(mid + 1) * N_BINS];
        let peak_bin = row.iter().enumerate().max_by_key(|(_, v)| *v).map(|(i, _)| i).unwrap();
        assert!(
            (peak_bin as i32 - target as i32).abs() <= 2,
            "expected ~bin {target}, got {peak_bin}; row max={}",
            row[peak_bin]
        );
        assert!(row[peak_bin] > 200);
    }

    #[test]
    fn silent_is_dark() {
        let dir = temp_dir("spec-silent");
        let wav = dir.join("silent.wav");
        write_wav(&wav, 16_000, 1, 0);
        let spec = compute(&wav, 0, |_| {}).unwrap();
        assert!(spec.values.iter().all(|&v| v < 10));
    }

    #[test]
    fn caches_by_file_identity() {
        let dir = temp_dir("spec-cache");
        let wav = dir.join("clip.wav");
        write_sine_wav(&wav, 16_000, 1, 880.0);
        let first = load_or_compute(wav.to_str().unwrap(), &dir, 0, |_| {}).unwrap();
        let cached = cache_file(&wav, &dir, 0).unwrap();
        assert!(cached.exists());
        fs::write(
            &cached,
            Spectrogram { hops_per_second: 1.0, n_bins: 1, values: vec![9] }.to_bytes(),
        )
        .unwrap();
        let second = load_or_compute(wav.to_str().unwrap(), &dir, 0, |_| {}).unwrap();
        assert_ne!(first, second);
        assert_eq!(Spectrogram::from_bytes(&second).unwrap().values, vec![9]);
    }

    /// Optional: `SUBSTUDIO_TEST_MEDIA=/path/film.mp4 cargo test fixture_media -- --nocapture`
    #[test]
    fn fixture_media_produces_hops() {
        let Ok(path) = std::env::var("SUBSTUDIO_TEST_MEDIA") else {
            eprintln!("skipping: set SUBSTUDIO_TEST_MEDIA to a file with audio");
            return;
        };
        let path = Path::new(&path);
        if !path.exists() {
            eprintln!("skipping: {path:?} missing");
            return;
        }
        let spec = compute(path, 0, |_| {}).expect("spectrogram from media");
        assert!(spec.values.len() >= N_BINS);
        assert!(spec.hops_per_second > 0.0);
        println!(
            "{}: hops={} bins={} rate={:.1}",
            path.display(),
            spec.values.len() / N_BINS,
            spec.n_bins,
            spec.hops_per_second
        );
    }
}
