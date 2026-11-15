//! Project sidecar (FIL-03): `<name>.substudio.json` next to `<name>.srt`.
//!
//! Holds what the SRT can't: the video, fps, timecode mode, bookmarks, the
//! original/script column (FIL-07), and the last selected cue. The subtitle
//! file itself is never touched. A missing or unreadable sidecar is treated as
//! "no project info", never as an error.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

pub const SIDECAR_SUFFIX: &str = ".substudio.json";
const VERSION: u32 = 1;

/// A cue reference that survives reloads: cue ids aren't saved in SRT, so we
/// keep the index plus the start time to re-find the cue if lines moved.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CueRef {
    pub index: usize,
    pub start: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkRef {
    pub index: usize,
    pub start: f64,
    #[serde(default)]
    pub note: String,
}

/// Original/script text for one cue (FIL-07). Not written to the SRT.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OriginalRef {
    pub index: usize,
    pub start: f64,
    #[serde(default)]
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Project {
    pub version: u32,
    /// Absolute path of the video as last opened.
    pub video_path: Option<String>,
    /// Video path relative to the sidecar's folder, so a moved project folder still finds it.
    pub video_relative: Option<String>,
    pub fps: Option<f64>,
    /// "frames" or "ms".
    pub timecode: Option<String>,
    pub bookmarks: Vec<BookmarkRef>,
    pub selected: Option<CueRef>,
    /// Path of the last opened original/script file, if any.
    pub original_path: Option<String>,
    /// Per-cue original/script texts (translation mode).
    pub originals: Vec<OriginalRef>,
}

impl Default for Project {
    fn default() -> Self {
        Self {
            version: VERSION,
            video_path: None,
            video_relative: None,
            fps: None,
            timecode: None,
            bookmarks: Vec::new(),
            selected: None,
            original_path: None,
            originals: Vec::new(),
        }
    }
}

/// `/films/Ìyá.srt` → `/films/Ìyá.substudio.json`.
pub fn sidecar_path(subtitle: &Path) -> PathBuf {
    let stem = subtitle
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "untitled".into());
    subtitle.with_file_name(format!("{stem}{SIDECAR_SUFFIX}"))
}

/// Reads the sidecar for `subtitle`. Missing, unreadable or corrupt → `None`.
/// The returned `video_path` is resolved: the absolute path if it still exists,
/// otherwise the relative one if that exists, otherwise the stored absolute path.
pub fn read(subtitle: &Path) -> Option<Project> {
    let path = sidecar_path(subtitle);
    let text = fs::read_to_string(&path).ok()?;
    let mut project: Project = serde_json::from_str(&text).ok()?;
    project.fps = project.fps.filter(|f| f.is_finite() && *f > 0.0 && *f <= 1000.0);
    project.bookmarks.retain(|b| b.start.is_finite());
    project.originals.retain(|o| o.start.is_finite());
    project.video_path = resolve_video(&path, project.video_path.take(), project.video_relative.as_deref());
    Some(project)
}

fn resolve_video(sidecar: &Path, absolute: Option<String>, relative: Option<&str>) -> Option<String> {
    if let Some(abs) = &absolute {
        if Path::new(abs).is_file() {
            return absolute;
        }
    }
    if let (Some(rel), Some(dir)) = (relative, sidecar.parent()) {
        let candidate = dir.join(rel);
        if candidate.is_file() {
            return Some(candidate.to_string_lossy().into_owned());
        }
    }
    absolute
}

/// Writes the sidecar atomically (temp file + rename) so a crash mid-write
/// never leaves a half-written project next to her subtitle.
pub fn write(subtitle: &Path, project: &Project) -> Result<(), String> {
    let path = sidecar_path(subtitle);
    let mut project = project.clone();
    project.version = VERSION;
    project.video_relative = match (&project.video_path, path.parent()) {
        (Some(video), Some(dir)) => relative_path(dir, Path::new(video)),
        _ => None,
    };
    let json = serde_json::to_string_pretty(&project).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        e.to_string()
    })
}

/// `video` relative to `dir` when it lives inside it (the usual "film folder" layout).
fn relative_path(dir: &Path, video: &Path) -> Option<String> {
    video
        .strip_prefix(dir)
        .ok()
        .map(|p| p.to_string_lossy().into_owned())
        .filter(|p| !p.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("substudio-project-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn sidecar_sits_next_to_the_subtitle() {
        assert_eq!(
            sidecar_path(Path::new("/films/Ìyá Mi.srt")),
            PathBuf::from("/films/Ìyá Mi.substudio.json")
        );
        assert_eq!(sidecar_path(Path::new("/films/cut.v2.vtt")), PathBuf::from("/films/cut.v2.substudio.json"));
    }

    #[test]
    fn round_trips_without_touching_the_subtitle() {
        let dir = temp_dir("roundtrip");
        let srt = dir.join("film.srt");
        fs::write(&srt, "1\n00:00:01,000 --> 00:00:02,000\nHi\n").unwrap();
        let video = dir.join("media").join("film.mp4");
        fs::create_dir_all(video.parent().unwrap()).unwrap();
        fs::write(&video, b"not really a video").unwrap();
        let project = Project {
            video_path: Some(video.to_string_lossy().into_owned()),
            fps: Some(24.0),
            timecode: Some("ms".into()),
            bookmarks: vec![BookmarkRef { index: 3, start: 12.5, note: "Check this".into() }],
            selected: Some(CueRef { index: 7, start: 30.04 }),
            original_path: Some("/films/script-yo.txt".into()),
            originals: vec![OriginalRef {
                index: 0,
                start: 1.0,
                text: "Báwo ni".into(),
            }],
            ..Project::default()
        };
        write(&srt, &project).unwrap();
        let back = read(&srt).unwrap();
        assert_eq!(back.video_path, project.video_path);
        assert_eq!(back.video_relative.as_deref(), Some("media/film.mp4"));
        assert_eq!(back.fps, Some(24.0));
        assert_eq!(back.timecode.as_deref(), Some("ms"));
        assert_eq!(back.bookmarks, project.bookmarks);
        assert_eq!(back.selected, project.selected);
        assert_eq!(back.original_path, project.original_path);
        assert_eq!(back.originals, project.originals);
        assert_eq!(fs::read_to_string(&srt).unwrap(), "1\n00:00:01,000 --> 00:00:02,000\nHi\n");
        assert!(!dir.join("film.substudio.json.tmp").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn finds_the_video_after_the_folder_moves() {
        let dir = temp_dir("moved");
        let srt = dir.join("film.srt");
        fs::write(dir.join("film.mp4"), b"x").unwrap();
        let json = r#"{"videoPath":"/Volumes/Gone/film.mp4","videoRelative":"film.mp4"}"#;
        fs::write(sidecar_path(&srt), json).unwrap();
        let back = read(&srt).unwrap();
        assert_eq!(back.video_path, Some(dir.join("film.mp4").to_string_lossy().into_owned()));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn missing_or_corrupt_sidecars_are_ignored() {
        let dir = temp_dir("corrupt");
        let srt = dir.join("film.srt");
        assert!(read(&srt).is_none());
        fs::write(sidecar_path(&srt), "{ not json").unwrap();
        assert!(read(&srt).is_none());
        // Unknown fields and missing fields are fine; bad values are dropped.
        fs::write(sidecar_path(&srt), r#"{"fps":-3,"future":true,"bookmarks":[{"index":1,"start":2.0}]}"#).unwrap();
        let p = read(&srt).unwrap();
        assert_eq!(p.fps, None);
        assert_eq!(p.bookmarks, vec![BookmarkRef { index: 1, start: 2.0, note: String::new() }]);
        let _ = fs::remove_dir_all(&dir);
    }
}
