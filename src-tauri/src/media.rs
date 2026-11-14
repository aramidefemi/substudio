//! Probe open video for the Media Information dialog.
//! Prefers `ffprobe` when on PATH; falls back to macOS `mdls`, then filesystem basics.

use serde::Serialize;
use std::path::Path;
use std::process::Command;

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
        tracks: vec![],
        source: "filesystem".into(),
        note: Some("Install ffprobe for codec and track details.".into()),
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

    let mut tracks = Vec::new();
    if let Some(streams) = v["streams"].as_array() {
        for (i, s) in streams.iter().enumerate() {
            let kind = s["codec_type"].as_str().unwrap_or("unknown").to_string();
            let codec = s["codec_name"].as_str().map(|x| x.to_string());
            let language = s["tags"]["language"].as_str().map(|x| x.to_string());
            let detail = match kind.as_str() {
                "video" => {
                    let w = s["width"].as_u64().unwrap_or(0);
                    let h = s["height"].as_u64().unwrap_or(0);
                    let fps = s["avg_frame_rate"].as_str().unwrap_or("");
                    if info.width.is_none() && w > 0 {
                        info.width = Some(w as u32);
                        info.height = Some(h as u32);
                        info.frame_rate = Some(fps.to_string());
                    }
                    Some(format!("{w}×{h} @ {fps}"))
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
    Ok(info)
}

fn try_ffprobe(path: &str) -> Option<MediaInfo> {
    let base = basic(path).ok()?;
    let out = Command::new("ffprobe")
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
    info.note = Some("Basic Spotlight metadata. Install ffprobe for full track details.".into());
    info.duration_secs = duration;
    info.width = width;
    info.height = height;
    if let Some(c) = content {
        // e.g. public.mpeg-4 → mpeg-4
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
        // mdls returns like: (\n    "H.264",\n    "AAC"\n)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_ffprobe_minimal() {
        let json = r#"{
          "format": {"format_name":"mov,mp4","duration":"12.5","bit_rate":"1000000"},
          "streams":[
            {"index":0,"codec_type":"video","codec_name":"h264","width":1920,"height":1080,"avg_frame_rate":"25/1"},
            {"index":1,"codec_type":"audio","codec_name":"aac","channels":2,"sample_rate":"48000","tags":{"language":"eng"}}
          ]
        }"#;
        let base = MediaInfo {
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
            tracks: vec![],
            source: "filesystem".into(),
            note: None,
        };
        let info = parse_ffprobe("/film.mp4", json, base).unwrap();
        assert_eq!(info.container.as_deref(), Some("mov,mp4"));
        assert_eq!(info.width, Some(1920));
        assert_eq!(info.tracks.len(), 2);
        assert_eq!(info.tracks[1].language.as_deref(), Some("eng"));
        assert_eq!(info.source, "ffprobe");
        assert_eq!(info.file_name, "film.mp4");
    }

    #[test]
    fn basic_missing_file_errors() {
        assert!(probe("/no/such/file.mp4").is_err());
    }
}
