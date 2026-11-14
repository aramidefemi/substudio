//! Waveform peaks from a media file's audio track: decode with symphonia,
//! keep the loudest sample per 10 ms bucket, and cache the result on disk so
//! reopening a film is instant. Sent to the frontend as raw bytes.

use std::fs::{self, File};
use std::hash::{DefaultHasher, Hash, Hasher};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use symphonia::core::codecs::audio::AudioDecoderOptions;
use symphonia::core::errors::Error as SymError;
use symphonia::core::formats::probe::Hint;
use symphonia::core::formats::{FormatOptions, TrackType};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;

/// Target resolution: one peak per 10 ms.
pub const PEAKS_PER_SECOND: u32 = 100;

const MAGIC: &[u8; 4] = b"SSPK";
const VERSION: u8 = 1;
const HEADER_LEN: usize = 4 + 1 + 8 + 4;

#[derive(Debug, PartialEq)]
pub struct Peaks {
    /// Peaks per second (sample rate / samples per bucket; ≈100).
    pub rate: f64,
    /// Loudest absolute sample in each bucket, 0–255.
    pub values: Vec<u8>,
}

impl Peaks {
    /// `SSPK` · version u8 · rate f64 LE · count u32 LE · values. Mirrors `parsePeaks` in TS.
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(HEADER_LEN + self.values.len());
        out.extend_from_slice(MAGIC);
        out.push(VERSION);
        out.extend_from_slice(&self.rate.to_le_bytes());
        out.extend_from_slice(&(self.values.len() as u32).to_le_bytes());
        out.extend_from_slice(&self.values);
        out
    }

    pub fn from_bytes(bytes: &[u8]) -> Option<Peaks> {
        if bytes.len() < HEADER_LEN || &bytes[0..4] != MAGIC || bytes[4] != VERSION {
            return None;
        }
        let rate = f64::from_le_bytes(bytes[5..13].try_into().ok()?);
        let len = u32::from_le_bytes(bytes[13..17].try_into().ok()?) as usize;
        let values = bytes.get(HEADER_LEN..HEADER_LEN + len)?.to_vec();
        Some(Peaks { rate, values })
    }
}

fn to_u8(v: f32) -> u8 {
    (v.abs().min(1.0) * 255.0).round() as u8
}

/// Decodes the first audio track. `progress` gets 0.0–1.0 at most ~100 times.
pub fn compute(path: &Path, mut progress: impl FnMut(f32)) -> Result<Peaks, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }
    let mut format = symphonia::default::get_probe()
        .probe(&hint, mss, FormatOptions::default(), MetadataOptions::default())
        .map_err(|e| format!("Unsupported media format: {e}"))?;

    let track = format.default_track(TrackType::Audio).ok_or("No audio track found")?;
    let track_id = track.id;
    let total = track.duration.map(|d| d.get());
    let params = track
        .codec_params
        .as_ref()
        .and_then(|p| p.audio())
        .ok_or("Audio track has no codec parameters")?
        .clone();
    let sample_rate = params.sample_rate.ok_or("Unknown audio sample rate")?;
    let mut decoder = symphonia::default::get_codecs()
        .make_audio_decoder(&params, &AudioDecoderOptions::default())
        .map_err(|e| format!("Unsupported audio codec: {e}"))?;

    let per_bucket = (sample_rate / PEAKS_PER_SECOND).max(1) as usize;
    let mut values = Vec::new();
    let mut bucket_max = 0f32;
    let mut in_bucket = 0usize;
    let mut samples: Vec<f32> = Vec::new();
    let mut last_pct = -1i64;

    loop {
        let packet = match format.next_packet() {
            Ok(Some(p)) => p,
            Ok(None) | Err(SymError::ResetRequired) => break,
            Err(SymError::IoError(e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(e) => return Err(e.to_string()),
        };
        if packet.track_id != track_id {
            continue;
        }
        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            // A damaged packet shouldn't sink the whole waveform.
            Err(SymError::DecodeError(_)) | Err(SymError::IoError(_)) => continue,
            Err(e) => return Err(e.to_string()),
        };
        let channels = decoded.spec().channels().count().max(1);
        samples.resize(decoded.samples_interleaved(), 0.0);
        decoded.copy_to_slice_interleaved(&mut samples);

        for frame in samples.chunks(channels) {
            let loudest = frame.iter().fold(0f32, |m, s| m.max(s.abs()));
            bucket_max = bucket_max.max(loudest);
            in_bucket += 1;
            if in_bucket == per_bucket {
                values.push(to_u8(bucket_max));
                bucket_max = 0.0;
                in_bucket = 0;
            }
        }

        if let Some(total) = total.filter(|t| *t > 0) {
            let pct = (packet.pts.get().max(0) as u64 * 100 / total) as i64;
            if pct > last_pct {
                last_pct = pct;
                progress((pct as f32 / 100.0).min(1.0));
            }
        }
    }
    if in_bucket > 0 {
        values.push(to_u8(bucket_max));
    }
    progress(1.0);
    Ok(Peaks { rate: sample_rate as f64 / per_bucket as f64, values })
}

/// Cache file for `path`, keyed by path, size and modification time.
fn cache_file(path: &Path, cache_dir: &Path) -> Result<PathBuf, String> {
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let mut h = DefaultHasher::new();
    (path, meta.len(), mtime, VERSION).hash(&mut h);
    Ok(cache_dir.join("waveforms").join(format!("{:016x}.sspk", h.finish())))
}

/// Cached peaks bytes for `path`, computing and caching them on a miss.
pub fn load_or_compute(path: &str, cache_dir: &Path, mut progress: impl FnMut(f32)) -> Result<Vec<u8>, String> {
    let media = Path::new(path);
    let cached = cache_file(media, cache_dir)?;
    if let Ok(bytes) = fs::read(&cached) {
        if Peaks::from_bytes(&bytes).is_some() {
            progress(1.0);
            return Ok(bytes);
        }
    }
    let bytes = compute(media, &mut progress)?.to_bytes();
    if let Some(dir) = cached.parent() {
        // A failed cache write only costs a recompute next time.
        let _ = fs::create_dir_all(dir).and_then(|_| fs::write(&cached, &bytes));
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 16-bit mono PCM WAV: `silent_s` of silence, then `loud_s` of a half-scale square wave.
    fn write_wav(path: &Path, rate: u32, silent_s: u32, loud_s: u32) {
        let n = (rate * (silent_s + loud_s)) as usize;
        let mut pcm = Vec::with_capacity(n * 2);
        for i in 0..n {
            let v: i16 = if i < (rate * silent_s) as usize { 0 } else if i % 2 == 0 { 16384 } else { -16384 };
            pcm.extend_from_slice(&v.to_le_bytes());
        }
        let mut wav = Vec::new();
        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&(36 + pcm.len() as u32).to_le_bytes());
        wav.extend_from_slice(b"WAVEfmt ");
        wav.extend_from_slice(&16u32.to_le_bytes());
        wav.extend_from_slice(&1u16.to_le_bytes()); // PCM
        wav.extend_from_slice(&1u16.to_le_bytes()); // mono
        wav.extend_from_slice(&rate.to_le_bytes());
        wav.extend_from_slice(&(rate * 2).to_le_bytes());
        wav.extend_from_slice(&2u16.to_le_bytes());
        wav.extend_from_slice(&16u16.to_le_bytes());
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&(pcm.len() as u32).to_le_bytes());
        wav.extend_from_slice(&pcm);
        fs::write(path, wav).unwrap();
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("substudio-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn peaks_follow_the_audio() {
        let dir = temp_dir("peaks");
        let wav = dir.join("clip.wav");
        write_wav(&wav, 8000, 1, 1);
        let mut reports = Vec::new();
        let peaks = compute(&wav, |p| reports.push(p)).unwrap();
        assert!((peaks.rate - 100.0).abs() < 1e-9);
        assert_eq!(peaks.values.len(), 200);
        assert!(peaks.values[..100].iter().all(|&v| v == 0), "first second is silent");
        assert!(peaks.values[100..].iter().all(|&v| (126..=129).contains(&v)), "second second is half scale");
        assert_eq!(reports.last(), Some(&1.0));
    }

    #[test]
    fn bytes_round_trip() {
        let p = Peaks { rate: 100.0, values: vec![0, 7, 255] };
        assert_eq!(Peaks::from_bytes(&p.to_bytes()), Some(p));
        assert_eq!(Peaks::from_bytes(b"nope"), None);
    }

    #[test]
    fn caches_by_file_identity() {
        let dir = temp_dir("cache");
        let wav = dir.join("clip.wav");
        write_wav(&wav, 8000, 0, 1);
        let first = load_or_compute(wav.to_str().unwrap(), &dir, |_| {}).unwrap();
        let cached = cache_file(&wav, &dir).unwrap();
        assert!(cached.exists());
        // Second call is served from the cache file.
        fs::write(&cached, Peaks { rate: 1.0, values: vec![9] }.to_bytes()).unwrap();
        let second = load_or_compute(wav.to_str().unwrap(), &dir, |_| {}).unwrap();
        assert_ne!(first, second);
        assert_eq!(Peaks::from_bytes(&second).unwrap().values, vec![9]);
    }

    /// Real-media check: `SUBSTUDIO_TEST_MEDIA=/path/film.mp4 cargo test real_media -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn real_media() {
        let Ok(path) = std::env::var("SUBSTUDIO_TEST_MEDIA") else { return };
        let started = std::time::Instant::now();
        let peaks = compute(Path::new(&path), |_| {}).unwrap();
        let seconds = peaks.values.len() as f64 / peaks.rate;
        let loud = peaks.values.iter().filter(|&&v| v > 25).count() as f64 / peaks.values.len().max(1) as f64;
        println!(
            "{path}: {seconds:.1}s of audio, {} peaks, {:.0}% above 10%, decoded in {:.2?}",
            peaks.values.len(),
            loud * 100.0,
            started.elapsed()
        );
        assert!(seconds > 1.0);
    }

    #[test]
    fn reports_files_without_audio() {
        let dir = temp_dir("noaudio");
        let junk = dir.join("notes.txt");
        fs::write(&junk, "not media").unwrap();
        assert!(compute(&junk, |_| {}).is_err());
    }
}
