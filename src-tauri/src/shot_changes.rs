//! Shot-change detection via bundled ffmpeg (SYN-04).
//!
//! Uses the `select=gt(scene,T)` filter + `showinfo` and parses `pts_time` from
//! stderr. Returns compact sorted unique timestamps (seconds). Results are
//! cached under the app cache dir by path+size+mtime; the project sidecar also
//! stores them so reopen skips a re-detect.

use std::fs::{self, File};
use std::hash::{DefaultHasher, Hash, Hasher};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::UNIX_EPOCH;

use crate::ffmpeg_bin;

const MAGIC: &[u8; 4] = b"SSSC";
const VERSION: u8 = 1;
/// Default scene threshold (0–1). Higher = fewer cuts. Matches common SE-ish defaults.
pub const DEFAULT_THRESHOLD: f64 = 0.3;

/// Encode as `SSSC` · version · count u32 LE · f64 LE × n.
pub fn encode(times: &[f64]) -> Vec<u8> {
    let mut out = Vec::with_capacity(4 + 1 + 4 + times.len() * 8);
    out.extend_from_slice(MAGIC);
    out.push(VERSION);
    out.extend_from_slice(&(times.len() as u32).to_le_bytes());
    for t in times {
        out.extend_from_slice(&t.to_le_bytes());
    }
    out
}

pub fn decode(bytes: &[u8]) -> Result<Vec<f64>, String> {
    if bytes.len() < 9 || &bytes[0..4] != MAGIC {
        return Err("bad shot-changes header".into());
    }
    if bytes[4] != VERSION {
        return Err("unsupported shot-changes version".into());
    }
    let n = u32::from_le_bytes(bytes[5..9].try_into().unwrap()) as usize;
    if bytes.len() != 9 + n * 8 {
        return Err("shot-changes length mismatch".into());
    }
    let mut times = Vec::with_capacity(n);
    for i in 0..n {
        let start = 9 + i * 8;
        times.push(f64::from_le_bytes(bytes[start..start + 8].try_into().unwrap()));
    }
    Ok(times)
}

fn cache_key(path: &Path, threshold: f64) -> Result<u64, String> {
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let mut h = DefaultHasher::new();
    path.to_string_lossy().hash(&mut h);
    meta.len().hash(&mut h);
    mtime.hash(&mut h);
    threshold.to_bits().hash(&mut h);
    Ok(h.finish())
}

fn cache_path(cache_dir: &Path, path: &Path, threshold: f64) -> Result<PathBuf, String> {
    let key = cache_key(path, threshold)?;
    Ok(cache_dir.join("shot-changes").join(format!("{key:016x}.sssc")))
}

/// Parse `pts_time:1.234` (or `pts_time: 1.234`) fragments from ffmpeg showinfo lines.
pub fn parse_showinfo_pts(stderr: &str) -> Vec<f64> {
    let mut times = Vec::new();
    for line in stderr.lines() {
        let Some(i) = line.find("pts_time:") else { continue };
        let rest = line[i + "pts_time:".len()..].trim_start();
        let token = rest.split_whitespace().next().unwrap_or("");
        if let Ok(t) = token.parse::<f64>() {
            if t.is_finite() && t >= 0.0 {
                times.push(t);
            }
        }
    }
    sort_unique(&mut times);
    times
}

fn sort_unique(times: &mut Vec<f64>) {
    times.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    times.dedup_by(|a, b| (*a - *b).abs() < 1e-4);
}

/// Run ffmpeg scene detect on `path`. Does not use cache.
pub fn detect(path: &str, threshold: f64) -> Result<Vec<f64>, String> {
    let path = Path::new(path);
    if !path.is_file() {
        return Err("Video file not found".into());
    }
    let ffmpeg = ffmpeg_bin::find_ffmpeg().ok_or("ffmpeg not found")?;
    let t = if threshold.is_finite() && threshold > 0.0 && threshold < 1.0 {
        threshold
    } else {
        DEFAULT_THRESHOLD
    };
    let filter = format!("select='gt(scene,{t})',showinfo");
    let mut child = Command::new(&ffmpeg)
        .args(["-hide_banner", "-nostats", "-i"])
        .arg(path)
        .args(["-filter:v", &filter, "-an", "-f", "null", "-"])
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("could not start ffmpeg: {e}"))?;
    let stderr = child.stderr.take().ok_or("ffmpeg stderr missing")?;
    let mut text = String::new();
    for line in BufReader::new(stderr).lines() {
        let line = line.map_err(|e| e.to_string())?;
        text.push_str(&line);
        text.push('\n');
    }
    let status = child.wait().map_err(|e| e.to_string())?;
    if !status.success() {
        return Err(format!("ffmpeg shot detection failed ({status})"));
    }
    Ok(parse_showinfo_pts(&text))
}

/// Load cached SSSC bytes or detect. Always returns encoded bytes.
pub fn load_or_detect(path: &str, cache_dir: &Path, threshold: f64) -> Result<Vec<u8>, String> {
    let path_obj = Path::new(path);
    if !path_obj.is_file() {
        return Err("Video file not found".into());
    }
    let t = if threshold.is_finite() && threshold > 0.0 && threshold < 1.0 {
        threshold
    } else {
        DEFAULT_THRESHOLD
    };
    let cache = cache_path(cache_dir, path_obj, t)?;
    if let Ok(bytes) = fs::read(&cache) {
        if decode(&bytes).is_ok() {
            return Ok(bytes);
        }
    }
    let times = detect(path, t)?;
    let bytes = encode(&times);
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

    #[test]
    fn round_trips_encode_decode() {
        let times = vec![0.0, 1.5, 12.345];
        let bytes = encode(&times);
        assert_eq!(decode(&bytes).unwrap(), times);
    }

    #[test]
    fn parses_showinfo_pts_times() {
        let stderr = "\
[Parsed_showinfo_1 @ 0x1] n:   0 pts:  90090 pts_time:1.001000 pos:…\n\
noise\n\
[Parsed_showinfo_1 @ 0x1] n:   1 pts: 180180 pts_time:12.500000 foo\n\
pts_time:12.5001\n";
        let times = parse_showinfo_pts(stderr);
        assert_eq!(times, vec![1.001, 12.5]);
    }

    #[test]
    fn rejects_bad_header() {
        assert!(decode(b"XXXX").is_err());
    }
}
