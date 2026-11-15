//! Probe open video for Media Information and the media layer (MED-01).
//!
//! Prefers bundled/PATH `ffprobe` (LGPL build via `scripts/fetch-ffmpeg.sh`);
//! falls back to macOS `mdls`, then filesystem basics. Frame timestamps are
//! extracted with ffprobe and cached next to waveform peaks so MED-03 can step
//! on real VFR times instead of `1/fps`.

use crate::ffmpeg_bin;
use serde::Serialize;
use std::fs::{self, File};
use std::hash::{DefaultHasher, Hash, Hasher};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::UNIX_EPOCH;

const FRAME_MAGIC: &[u8; 4] = b"SSFT";
const FRAME_VERSION: u8 = 1;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaTrack {
    pub index: u32,
    pub kind: String,
    pub codec: Option<String>,
    pub language: Option<String>,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub modified_ms: Option<u64>,
    pub container: Option<String>,
    pub duration_secs: Option<f64>,
    pub bit_rate: Option<u64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub frame_rate: Option<String>,
    /// Numeric average fps when parseable (for project fps / TIM-07).
    pub fps: Option<f64>,
    /// Container/stream start offset in seconds (often 0; non-zero on some phones).
    pub start_time_secs: Option<f64>,
    /// True when r_frame_rate and avg_frame_rate disagree, or packet intervals vary.
    pub variable_frame_rate: Option<bool>,
    pub frame_count: Option<u64>,
    pub tracks: Vec<MediaTrack>,
    pub source: String,
    pub note: Option<String>,
}

fn file_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string())
}

fn parse_rate(s: &str) -> Option<f64> {
    let s = s.trim();
    if s.is_empty() || s == "0/0" || s == "N/A" {
        return None;
    }
    if let Some((a, b)) = s.split_once('/') {
        let num: f64 = a.parse().ok()?;
        let den: f64 = b.parse().ok()?;
        if den == 0.0 {
            return None;
        }
        let fps = num / den;
        return (fps.is_finite() && fps > 0.0).then_some(fps);
    }
    s.parse().ok().filter(|v: &f64| v.is_finite() && *v > 0.0)
}

fn rates_differ(a: f64, b: f64) -> bool {
    (a - b).abs() > (0.05_f64).max(a * 0.002)
}

fn basic(path: &str) -> Result<MediaInfo, String> {
    let meta = std::fs::metadata(path).map_err(|e| e.to_string())?;
    let modified_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64);
    let ext = Path::new(path)
        .extension()
        .map(|e| e.to_string_lossy().to_ascii_lowercase());
    Ok(MediaInfo {
        path: path.to_string(),
        file_name: file_name(path),
        size_bytes: meta.len(),
        modified_ms,
        container: ext,
        duration_secs: None,
        bit_rate: None,
        width: None,
        height: None,
        frame_rate: None,
        fps: None,
        start_time_secs: None,
        variable_frame_rate: None,
        frame_count: None,
        tracks: vec![],
        source: "filesystem".into(),
        note: Some("Install or bundle ffprobe for codec and track details.".into()),
    })
}

fn parse_ffprobe(path: &str, json: &str, base: MediaInfo) -> Result<MediaInfo, String> {
    let v: serde_json::Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
    let format = &v["format"];
    let mut info = base;
    info.path = path.to_string();
    info.file_name = file_name(path);
    info.source = "ffprobe".into();
    info.note = None;
    info.container = format["format_name"]
        .as_str()
        .map(|s| s.to_string())
        .or(info.container);
    info.duration_secs = format["duration"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .or_else(|| format["duration"].as_f64());
    info.bit_rate = format["bit_rate"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .or_else(|| format["bit_rate"].as_u64());
    info.start_time_secs = format["start_time"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .or_else(|| format["start_time"].as_f64())
        .or(info.start_time_secs);

    let mut tracks = Vec::new();
    let mut saw_video = false;
    if let Some(streams) = v["streams"].as_array() {
        for (i, s) in streams.iter().enumerate() {
            let kind = s["codec_type"].as_str().unwrap_or("unknown").to_string();
            let codec = s["codec_name"].as_str().map(|x| x.to_string());
            let language = s["tags"]["language"].as_str().map(|x| x.to_string());
            let stream_start = s["start_time"]
                .as_str()
                .and_then(|t| t.parse().ok())
                .or_else(|| s["start_time"].as_f64());
            if info.start_time_secs.is_none() {
                info.start_time_secs = stream_start;
            }
            let detail = match kind.as_str() {
                "video" => {
                    let w = s["width"].as_u64().unwrap_or(0);
                    let h = s["height"].as_u64().unwrap_or(0);
                    let avg = s["avg_frame_rate"].as_str().unwrap_or("");
                    let r = s["r_frame_rate"].as_str().unwrap_or("");
                    if !saw_video && w > 0 {
                        saw_video = true;
                        info.width = Some(w as u32);
                        info.height = Some(h as u32);
                        info.frame_rate = Some(if avg.is_empty() { r } else { avg }.to_string());
                        info.fps = parse_rate(avg).or_else(|| parse_rate(r));
                        if let (Some(avg_f), Some(r_f)) = (parse_rate(avg), parse_rate(r)) {
                            info.variable_frame_rate = Some(rates_differ(avg_f, r_f));
                        } else if s["avg_frame_rate"] != s["r_frame_rate"]
                            && !avg.is_empty()
                            && !r.is_empty()
                        {
                            info.variable_frame_rate = Some(avg != r);
                        }
                        info.frame_count = s["nb_frames"]
                            .as_str()
                            .and_then(|n| n.parse().ok())
                            .or_else(|| s["nb_frames"].as_u64());
                        // Duration × avg fps vs declared frame count → VFR hint.
                        if info.variable_frame_rate != Some(true) {
                            if let (Some(dur), Some(fps), Some(n)) =
                                (info.duration_secs, info.fps, info.frame_count)
                            {
                                let expected = dur * fps;
                                if expected > 1.0 && (expected - n as f64).abs() > 2.0 {
                                    info.variable_frame_rate = Some(true);
                                }
                            }
                        }
                    }
                    Some(format!("{w}×{h} @ {avg}"))
                }
                "audio" => {
                    let ch = s["channels"].as_u64().unwrap_or(0);
                    let rate = s["sample_rate"].as_str().unwrap_or("?");
                    Some(format!("{ch} ch, {rate} Hz"))
                }
                _ => None,
            };
            tracks.push(MediaTrack {
                index: s["index"].as_u64().unwrap_or(i as u64) as u32,
                kind,
                codec,
                language,
                detail,
            });
        }
    }
    info.tracks = tracks;
    if info.variable_frame_rate.is_none() && saw_video {
        info.variable_frame_rate = Some(false);
    }
    Ok(info)
}

fn try_ffprobe(path: &str) -> Option<MediaInfo> {
    let ffprobe = ffmpeg_bin::find_ffprobe()?;
    let base = basic(path).ok()?;
    let out = Command::new(&ffprobe)
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            path,
        ])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let json = String::from_utf8_lossy(&out.stdout);
    parse_ffprobe(path, &json, base).ok()
}

#[cfg(target_os = "macos")]
fn mdls_value(path: &str, key: &str) -> Option<String> {
    let out = Command::new("mdls")
        .args(["-raw", "-name", key, path])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() || s == "(null)" {
        return None;
    }
    Some(s)
}

#[cfg(target_os = "macos")]
fn try_mdls(path: &str) -> Option<MediaInfo> {
    let mut info = basic(path).ok()?;
    let duration = mdls_value(path, "kMDItemDurationSeconds").and_then(|s| s.parse().ok());
    let width = mdls_value(path, "kMDItemPixelWidth").and_then(|s| s.parse().ok());
    let height = mdls_value(path, "kMDItemPixelHeight").and_then(|s| s.parse().ok());
    let codecs = mdls_value(path, "kMDItemCodecs");
    let content = mdls_value(path, "kMDItemContentTypeTree")
        .or_else(|| mdls_value(path, "kMDItemContentType"));

    if duration.is_none() && width.is_none() && codecs.is_none() {
        return None;
    }

    info.source = "mdls".into();
    info.note = Some("Basic Spotlight metadata. Bundle ffprobe for full track details.".into());
    info.duration_secs = duration;
    info.width = width;
    info.height = height;
    if let Some(c) = content {
        let short = c
            .split(',')
            .next()
            .unwrap_or(&c)
            .trim()
            .trim_start_matches('(')
            .trim_end_matches(')')
            .trim()
            .trim_start_matches('"')
            .trim_end_matches('"')
            .rsplit('.')
            .next()
            .unwrap_or(&c)
            .to_string();
        if !short.is_empty() {
            info.container = Some(short);
        }
    }
    if let Some(raw) = codecs {
        let names: Vec<String> = raw
            .split(|c: char| c == '"' || c == ',' || c == '(' || c == ')' || c == '\n')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .collect();
        for (i, name) in names.into_iter().enumerate() {
            let kind = if name.to_ascii_lowercase().contains("aac")
                || name.to_ascii_lowercase().contains("audio")
                || name.to_ascii_lowercase().contains("mp3")
            {
                "audio"
            } else {
                "video"
            };
            let detail = if kind == "video" {
                info.width
                    .zip(info.height)
                    .map(|(w, h)| format!("{w}×{h}"))
            } else {
                None
            };
            info.tracks.push(MediaTrack {
                index: i as u32,
                kind: kind.into(),
                codec: Some(name),
                language: None,
                detail,
            });
        }
    }
    Some(info)
}

#[cfg(not(target_os = "macos"))]
fn try_mdls(_path: &str) -> Option<MediaInfo> {
    None
}

/// Probe media at `path`. Never uploads; local tools only.
pub fn probe(path: &str) -> Result<MediaInfo, String> {
    if !Path::new(path).is_file() {
        return Err("Video file not found".into());
    }
    if let Some(info) = try_ffprobe(path) {
        return Ok(info);
    }
    if let Some(info) = try_mdls(path) {
        return Ok(info);
    }
    basic(path)
}

/* ---------- frame timestamps (MED-01 → MED-03) ---------- */

fn cache_key(path: &Path) -> Result<u64, String> {
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    let mtime = meta
        .modified()
        .map_err(|e| e.to_string())?
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let mut h = DefaultHasher::new();
    path.to_string_lossy().hash(&mut h);
    meta.len().hash(&mut h);
    mtime.hash(&mut h);
    Ok(h.finish())
}

fn frame_cache_path(cache_dir: &Path, path: &Path) -> Result<PathBuf, String> {
    let key = cache_key(path)?;
    Ok(cache_dir.join("frame-times").join(format!("{key:016x}.ssft")))
}

/// Encode timestamps as `SSFT` · version · count u32 LE · f64 LE × n.
pub fn encode_frame_times(times: &[f64]) -> Vec<u8> {
    let mut out = Vec::with_capacity(4 + 1 + 4 + times.len() * 8);
    out.extend_from_slice(FRAME_MAGIC);
    out.push(FRAME_VERSION);
    out.extend_from_slice(&(times.len() as u32).to_le_bytes());
    for t in times {
        out.extend_from_slice(&t.to_le_bytes());
    }
    out
}

pub fn decode_frame_times(bytes: &[u8]) -> Result<Vec<f64>, String> {
    if bytes.len() < 9 || &bytes[0..4] != FRAME_MAGIC {
        return Err("bad frame-times header".into());
    }
    if bytes[4] != FRAME_VERSION {
        return Err("unsupported frame-times version".into());
    }
    let n = u32::from_le_bytes(bytes[5..9].try_into().unwrap()) as usize;
    if bytes.len() != 9 + n * 8 {
        return Err("frame-times length mismatch".into());
    }
    let mut times = Vec::with_capacity(n);
    for i in 0..n {
        let start = 9 + i * 8;
        times.push(f64::from_le_bytes(bytes[start..start + 8].try_into().unwrap()));
    }
    Ok(times)
}

fn extract_frame_times(path: &Path) -> Result<Vec<f64>, String> {
    let ffprobe = ffmpeg_bin::find_ffprobe().ok_or("ffprobe not found")?;
    let mut child = Command::new(&ffprobe)
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "packet=pts_time",
            "-of",
            "csv=p=0",
        ])
        .arg(path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("could not start ffprobe: {e}"))?;
    let stdout = child.stdout.take().ok_or("ffprobe stdout missing")?;
    let mut times = Vec::new();
    for line in BufReader::new(stdout).lines() {
        let line = line.map_err(|e| e.to_string())?;
        let line = line.trim();
        if line.is_empty() || line == "N/A" {
            continue;
        }
        if let Ok(t) = line.parse::<f64>() {
            if t.is_finite() && t >= 0.0 {
                times.push(t);
            }
        }
    }
    let status = child.wait().map_err(|e| e.to_string())?;
    if !status.success() {
        return Err(format!("ffprobe exited with {status}"));
    }
    if times.is_empty() {
        return Err("ffprobe returned no video packet timestamps".into());
    }
    // Ensure sorted unique (some containers repeat).
    times.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    times.dedup_by(|a, b| (*a - *b).abs() < 1e-9);
    Ok(times)
}

/// Detect VFR from timestamp deltas (coefficient of variation of intervals).
#[allow(dead_code)] // available for MED-03 / callers refining probe after extract
pub fn timestamps_look_vfr(times: &[f64]) -> bool {
    if times.len() < 8 {
        return false;
    }
    let mut deltas: Vec<f64> = times.windows(2).map(|w| w[1] - w[0]).filter(|d| *d > 1e-6).collect();
    if deltas.len() < 4 {
        return false;
    }
    // Drop extreme outliers (seek/edit points) then compare spread.
    deltas.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let lo = deltas.len() / 20;
    let hi = deltas.len().saturating_sub(lo.max(1));
    let slice = &deltas[lo..hi.max(lo + 1)];
    let mean = slice.iter().sum::<f64>() / slice.len() as f64;
    if mean <= 0.0 {
        return false;
    }
    let var = slice.iter().map(|d| {
        let x = d - mean;
        x * x
    }).sum::<f64>() / slice.len() as f64;
    (var.sqrt() / mean) > 0.08
}

/// Load cached frame timestamps or extract with ffprobe. Returns SSFT bytes.
pub fn load_or_extract_frame_times(path: &str, cache_dir: &Path) -> Result<Vec<u8>, String> {
    let path = Path::new(path);
    if !path.is_file() {
        return Err("Video file not found".into());
    }
    let cache = frame_cache_path(cache_dir, path)?;
    if let Ok(bytes) = fs::read(&cache) {
        if decode_frame_times(&bytes).is_ok() {
            return Ok(bytes);
        }
    }
    let times = extract_frame_times(path)?;
    let bytes = encode_frame_times(&times);
    if let Some(parent) = cache.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(mut f) = File::create(&cache) {
        let _ = f.write_all(&bytes);
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty_base() -> MediaInfo {
        MediaInfo {
            path: String::new(),
            file_name: String::new(),
            size_bytes: 0,
            modified_ms: None,
            container: None,
            duration_secs: None,
            bit_rate: None,
            width: None,
            height: None,
            frame_rate: None,
            fps: None,
            start_time_secs: None,
            variable_frame_rate: None,
            frame_count: None,
            tracks: vec![],
            source: "filesystem".into(),
            note: None,
        }
    }

    #[test]
    fn parse_ffprobe_minimal() {
        let json = r#"{
          "format": {"format_name":"mov,mp4","duration":"12.5","bit_rate":"1000000","start_time":"0.040000"},
          "streams":[
            {"index":0,"codec_type":"video","codec_name":"h264","width":1920,"height":1080,"avg_frame_rate":"25/1","r_frame_rate":"25/1","nb_frames":"312","start_time":"0.040000"},
            {"index":1,"codec_type":"audio","codec_name":"aac","channels":2,"sample_rate":"48000","tags":{"language":"eng"}}
          ]
        }"#;
        let info = parse_ffprobe("/film.mp4", json, empty_base()).unwrap();
        assert_eq!(info.container.as_deref(), Some("mov,mp4"));
        assert_eq!(info.width, Some(1920));
        assert_eq!(info.tracks.len(), 2);
        assert_eq!(info.tracks[1].language.as_deref(), Some("eng"));
        assert_eq!(info.source, "ffprobe");
        assert_eq!(info.file_name, "film.mp4");
        assert_eq!(info.fps, Some(25.0));
        assert_eq!(info.start_time_secs, Some(0.04));
        assert_eq!(info.variable_frame_rate, Some(false));
        assert_eq!(info.frame_count, Some(312));
    }

    #[test]
    fn parse_ffprobe_detects_vfr_from_rates() {
        let json = r#"{
          "format": {"format_name":"mov,mp4","duration":"10.0"},
          "streams":[
            {"index":0,"codec_type":"video","codec_name":"h264","width":1280,"height":720,"avg_frame_rate":"24/1","r_frame_rate":"30/1"}
          ]
        }"#;
        let info = parse_ffprobe("/vfr.mp4", json, empty_base()).unwrap();
        assert_eq!(info.variable_frame_rate, Some(true));
        assert_eq!(info.fps, Some(24.0));
    }

    #[test]
    fn parse_rate_fraction() {
        assert_eq!(parse_rate("30000/1001").unwrap(), 30000.0 / 1001.0);
        assert!(parse_rate("0/0").is_none());
    }

    #[test]
    fn frame_times_round_trip() {
        let times = vec![0.0, 0.04, 0.08, 1.234567];
        let bytes = encode_frame_times(&times);
        assert_eq!(decode_frame_times(&bytes).unwrap(), times);
    }

    #[test]
    fn vfr_from_timestamps() {
        let cfr: Vec<f64> = (0..30).map(|i| i as f64 / 25.0).collect();
        assert!(!timestamps_look_vfr(&cfr));
        let mut vfr = cfr.clone();
        for i in (0..30).step_by(3) {
            vfr[i] += 0.02;
        }
        // Rebuild as cumulative irregular intervals
        let mut t = 0.0;
        let mut irregular = vec![0.0];
        for i in 0..40 {
            t += if i % 5 == 0 { 1.0 / 20.0 } else { 1.0 / 30.0 };
            irregular.push(t);
        }
        assert!(timestamps_look_vfr(&irregular));
    }

    #[test]
    fn basic_missing_file_errors() {
        assert!(probe("/no/such/file.mp4").is_err());
    }
}
