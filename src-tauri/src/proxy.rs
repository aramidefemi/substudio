//! Editing-proxy path (MED-02).
//!
//! Play the source in WebKit when the container/codecs are safe; otherwise
//! build a cached H.264 (+ AAC) MP4 via VideoToolbox that keeps source frame
//! timing. The original file is never modified. Subtitle times always refer
//! to the source timeline (`currentTime` on the proxy matches source time).

use crate::ffmpeg_bin;
use crate::media::{self, MediaInfo};
use serde::Serialize;
use std::fs::{self, File};
use std::hash::{DefaultHasher, Hash, Hasher};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::UNIX_EPOCH;

/// Bump when encode args or proxy container change (invalidates cache).
const PROXY_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackDecision {
    pub source_path: String,
    /// Path to feed `<video>` (source or proxy). Always a readable file when `ready`.
    pub playback_path: String,
    pub using_proxy: bool,
    pub from_cache: bool,
    /// Why a proxy was chosen (or why encode failed context).
    pub reason: Option<String>,
}

fn ext_of(path: &str) -> String {
    Path::new(path)
        .extension()
        .map(|e| e.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default()
}

fn container_ok(info: &MediaInfo) -> bool {
    let ext = ext_of(&info.path);
    if matches!(ext.as_str(), "mp4" | "m4v" | "mov") {
        return true;
    }
    let c = info.container.as_deref().unwrap_or("").to_ascii_lowercase();
    // ffprobe format_name is often "mov,mp4,m4a,3gp,3g2,mj2"
    let hints = ["mp4", "mov", "m4v", "isom", "quicktime"];
    hints.iter().any(|h| c.split(',').any(|p| p.trim() == *h) || c.contains(h))
        && !c.contains("matroska")
        && !c.contains("webm")
        && !c.contains("avi")
        && !c.contains("mpegts")
}

fn norm_codec(c: &str) -> String {
    c.trim().to_ascii_lowercase().replace([' ', '-'], "")
}

fn video_codec_ok(codec: &str) -> bool {
    let c = norm_codec(codec);
    matches!(
        c.as_str(),
        "h264" | "avc" | "avc1" | "avc3" | "hevc" | "h265" | "hev1" | "hvc1"
    )
}

fn audio_codec_ok(codec: &str) -> bool {
    let c = norm_codec(codec);
    c.starts_with("pcm")
        || matches!(
            c.as_str(),
            "aac" | "mp4a" | "mp3" | "mp3float" | "alac" | "flac"
        )
}

/// Returns `None` when WebKit can play the source; `Some(reason)` when a proxy is needed.
pub fn proxy_reason(info: &MediaInfo) -> Option<String> {
    if !container_ok(info) {
        let c = info
            .container
            .clone()
            .unwrap_or_else(|| ext_of(&info.path));
        return Some(format!("container “{c}” is not WebKit-safe"));
    }

    let video = info.tracks.iter().find(|t| t.kind == "video");
    match video.and_then(|t| t.codec.as_deref()) {
        Some(c) if video_codec_ok(c) => {}
        Some(c) => return Some(format!("video codec “{c}” needs a proxy")),
        None => {
            // Extension-only probe: trust mp4/mov/m4v; otherwise proxy.
            if info.source == "filesystem" && matches!(ext_of(&info.path).as_str(), "mp4" | "m4v" | "mov")
            {
                return None;
            }
            if info.tracks.is_empty() && matches!(ext_of(&info.path).as_str(), "mp4" | "m4v" | "mov") {
                return None;
            }
            return Some("no playable video track detected".into());
        }
    }

    let audio: Vec<_> = info.tracks.iter().filter(|t| t.kind == "audio").collect();
    if audio.is_empty() {
        return None;
    }
    if audio.iter().any(|t| t.codec.as_deref().is_some_and(audio_codec_ok)) {
        return None;
    }
    let names: Vec<_> = audio
        .iter()
        .filter_map(|t| t.codec.as_deref())
        .collect();
    Some(format!(
        "audio codec{} not WebKit-safe",
        if names.is_empty() {
            String::new()
        } else {
            format!(" ({})", names.join(", "))
        }
    ))
}

fn cache_key(path: &Path) -> Result<u64, String> {
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let mut h = DefaultHasher::new();
    (path.to_string_lossy().as_ref(), meta.len(), mtime, PROXY_VERSION).hash(&mut h);
    Ok(h.finish())
}

fn proxy_cache_path(cache_dir: &Path, path: &Path) -> Result<PathBuf, String> {
    let key = cache_key(path)?;
    Ok(cache_dir.join("proxies").join(format!("{key:016x}.mp4")))
}

fn parse_ffmpeg_time(s: &str) -> Option<f64> {
    // HH:MM:SS.ss or MM:SS.ss
    let parts: Vec<&str> = s.trim().split(':').collect();
    match parts.as_slice() {
        [h, m, sec] => {
            let h: f64 = h.parse().ok()?;
            let m: f64 = m.parse().ok()?;
            let sec: f64 = sec.parse().ok()?;
            Some(h * 3600.0 + m * 60.0 + sec)
        }
        [m, sec] => {
            let m: f64 = m.parse().ok()?;
            let sec: f64 = sec.parse().ok()?;
            Some(m * 60.0 + sec)
        }
        _ => None,
    }
}

fn progress_from_line(line: &str, duration: Option<f64>) -> Option<f32> {
    let idx = line.find("time=")?;
    let rest = &line[idx + 5..];
    let token = rest.split_whitespace().next()?;
    if token == "N/A" {
        return None;
    }
    let t = parse_ffmpeg_time(token)?;
    let dur = duration.filter(|d| *d > 0.05)?;
    Some((t / dur).clamp(0.0, 0.99) as f32)
}

/// Encode an H.264/AAC editing proxy with VideoToolbox, preserving source timestamps.
pub fn encode_proxy(path: &Path, dest: &Path, duration: Option<f64>, progress: &mut dyn FnMut(f32)) -> Result<(), String> {
    let ffmpeg = ffmpeg_bin::find_ffmpeg().ok_or("ffmpeg not found")?;
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = dest.with_extension("mp4.partial");
    let _ = fs::remove_file(&tmp);

    // -fps_mode passthrough keeps VFR/CFR timing; no -r / no retiming filters.
    // Original is read-only input; we only write under the app cache.
    let mut child = Command::new(&ffmpeg)
        .args([
            "-hide_banner",
            "-y",
            "-i",
        ])
        .arg(path)
        .args([
            "-map",
            "0:v:0",
            "-map",
            "0:a:0?",
            "-c:v",
            "h264_videotoolbox",
            "-b:v",
            "8M",
            "-allow_sw",
            "1",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ac",
            "2",
            "-fps_mode",
            "passthrough",
            "-movflags",
            "+faststart",
            "-f",
            "mp4",
        ])
        .arg(&tmp)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("could not start ffmpeg: {e}"))?;

    let stderr = child.stderr.take().ok_or("ffmpeg stderr missing")?;
    let mut last_p = 0.0_f32;
    progress(0.0);
    for line in BufReader::new(stderr).lines() {
        let line = line.map_err(|e| e.to_string())?;
        if let Some(p) = progress_from_line(&line, duration) {
            if p - last_p >= 0.01 {
                last_p = p;
                progress(p);
            }
        }
    }
    let status = child.wait().map_err(|e| e.to_string())?;
    if !status.success() {
        let _ = fs::remove_file(&tmp);
        return Err(format!("ffmpeg proxy encode failed ({status})"));
    }
    if !tmp.is_file() {
        return Err("ffmpeg produced no proxy file".into());
    }
    fs::rename(&tmp, dest).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        e.to_string()
    })?;
    // Touch a tiny sidecar marker so we know it's ours (optional integrity).
    let marker = dest.with_extension("mp4.ok");
    if let Ok(mut f) = File::create(&marker) {
        let _ = writeln!(f, "substudio-proxy v{PROXY_VERSION}");
    }
    progress(1.0);
    Ok(())
}

fn proxy_ready(path: &Path) -> bool {
    path.is_file()
        && path.metadata().map(|m| m.len() > 0).unwrap_or(false)
        && path.with_extension("mp4.ok").is_file()
}

/// Decide playback path: source, cached proxy, or encode a new proxy.
pub fn ensure_playback(path: &str, cache_dir: &Path, mut progress: impl FnMut(f32)) -> Result<PlaybackDecision, String> {
    let source = Path::new(path);
    if !source.is_file() {
        return Err("Video file not found".into());
    }
    let info = media::probe(path)?;
    if let Some(reason) = proxy_reason(&info) {
        let dest = proxy_cache_path(cache_dir, source)?;
        if proxy_ready(&dest) {
            progress(1.0);
            return Ok(PlaybackDecision {
                source_path: path.to_string(),
                playback_path: dest.to_string_lossy().into_owned(),
                using_proxy: true,
                from_cache: true,
                reason: Some(reason),
            });
        }
        encode_proxy(source, &dest, info.duration_secs, &mut progress)?;
        Ok(PlaybackDecision {
            source_path: path.to_string(),
            playback_path: dest.to_string_lossy().into_owned(),
            using_proxy: true,
            from_cache: false,
            reason: Some(reason),
        })
    } else {
        progress(1.0);
        Ok(PlaybackDecision {
            source_path: path.to_string(),
            playback_path: path.to_string(),
            using_proxy: false,
            from_cache: false,
            reason: None,
        })
    }
}

/// Quick plan without encoding (for tests / UI hints).
#[allow(dead_code)]
pub fn plan(info: &MediaInfo) -> PlaybackDecision {
    match proxy_reason(info) {
        None => PlaybackDecision {
            source_path: info.path.clone(),
            playback_path: info.path.clone(),
            using_proxy: false,
            from_cache: false,
            reason: None,
        },
        Some(reason) => PlaybackDecision {
            source_path: info.path.clone(),
            playback_path: info.path.clone(),
            using_proxy: true,
            from_cache: false,
            reason: Some(reason),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn info(
        path: &str,
        container: &str,
        video: Option<&str>,
        audio: Option<&str>,
    ) -> MediaInfo {
        let mut tracks = vec![];
        if let Some(c) = video {
            tracks.push(media::MediaTrack {
                index: 0,
                kind: "video".into(),
                codec: Some(c.into()),
                language: None,
                detail: None,
            });
        }
        if let Some(c) = audio {
            tracks.push(media::MediaTrack {
                index: 1,
                kind: "audio".into(),
                codec: Some(c.into()),
                language: None,
                detail: None,
            });
        }
        MediaInfo {
            path: path.into(),
            file_name: Path::new(path)
                .file_name()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_default(),
            size_bytes: 1,
            modified_ms: None,
            container: Some(container.into()),
            duration_secs: Some(10.0),
            bit_rate: None,
            width: Some(1920),
            height: Some(1080),
            frame_rate: Some("25/1".into()),
            fps: Some(25.0),
            start_time_secs: Some(0.0),
            variable_frame_rate: Some(false),
            frame_count: Some(250),
            tracks,
            source: "ffprobe".into(),
            note: None,
        }
    }

    #[test]
    fn h264_mp4_plays_source() {
        assert!(proxy_reason(&info("/a.mp4", "mov,mp4", Some("h264"), Some("aac"))).is_none());
    }

    #[test]
    fn hevc_mov_plays_source() {
        assert!(proxy_reason(&info("/a.mov", "mov,mp4", Some("hevc"), Some("aac"))).is_none());
    }

    #[test]
    fn mkv_needs_proxy() {
        let r = proxy_reason(&info("/a.mkv", "matroska,webm", Some("h264"), Some("aac")));
        assert!(r.unwrap().contains("container"));
    }

    #[test]
    fn prores_needs_proxy() {
        let r = proxy_reason(&info("/a.mov", "mov,mp4", Some("prores"), Some("pcm_s16le")));
        assert!(r.unwrap().contains("prores"));
    }

    #[test]
    fn ac3_audio_needs_proxy() {
        let r = proxy_reason(&info("/a.mp4", "mov,mp4", Some("h264"), Some("ac3")));
        assert!(r.unwrap().contains("audio"));
    }

    #[test]
    fn parse_time_progress() {
        assert!((parse_ffmpeg_time("00:01:30.50").unwrap() - 90.5).abs() < 1e-6);
        let p = progress_from_line("frame=1 time=00:00:05.00 bitrate=N/A", Some(10.0)).unwrap();
        assert!((p - 0.5).abs() < 0.01);
    }

    #[test]
    fn cache_key_stable() {
        let dir = std::env::temp_dir().join("substudio-proxy-test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let f = dir.join("clip.mp4");
        fs::write(&f, b"fake").unwrap();
        let a = cache_key(&f).unwrap();
        let b = cache_key(&f).unwrap();
        assert_eq!(a, b);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn plan_marks_proxy_without_encoding() {
        let d = plan(&info("/a.mkv", "matroska", Some("h264"), Some("aac")));
        assert!(d.using_proxy);
        assert_eq!(d.playback_path, "/a.mkv");
    }

    #[test]
    fn encode_proxy_reuses_cache() {
        let Some(ffmpeg) = ffmpeg_bin::find_ffmpeg() else {
            eprintln!("skipping: ffmpeg not found");
            return;
        };
        let dir = std::env::temp_dir().join(format!("substudio-proxy-enc-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let src = dir.join("src.mkv");
        // Tiny synthetic clip in a non-WebKit container so ensure_playback encodes.
        let status = Command::new(&ffmpeg)
            .args([
                "-hide_banner",
                "-y",
                "-f",
                "lavfi",
                "-i",
                "color=c=black:s=160x120:d=0.4",
                "-f",
                "lavfi",
                "-i",
                "sine=f=440:d=0.4",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-shortest",
            ])
            .arg(&src)
            .status();
        let Ok(st) = status else {
            let _ = fs::remove_dir_all(&dir);
            eprintln!("skipping: could not spawn ffmpeg to make fixture");
            return;
        };
        if !st.success() {
            let _ = fs::remove_dir_all(&dir);
            eprintln!("skipping: fixture encode failed (need libx264)");
            return;
        }
        let cache = dir.join("cache");
        let mut n = 0;
        let d1 = ensure_playback(src.to_str().unwrap(), &cache, |_| n += 1).unwrap();
        assert!(d1.using_proxy);
        assert!(!d1.from_cache);
        assert!(Path::new(&d1.playback_path).is_file());
        let d2 = ensure_playback(src.to_str().unwrap(), &cache, |_| {}).unwrap();
        assert!(d2.from_cache);
        assert_eq!(d1.playback_path, d2.playback_path);
        let _ = fs::remove_dir_all(&dir);
    }
}
