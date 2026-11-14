//! Disk helpers: reveal in Finder, mtimes, encoding decode, auto-backups.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::subtitles::{self, Cue, SubtitleFormat};

const BACKUP_DIR: &str = "auto-backup";

/// Labels accepted by `encoding_rs` (plus UTF-8).
pub const ENCODINGS: &[&str] = &[
    "utf-8",
    "windows-1252",
    "iso-8859-1",
    "windows-1250",
    "windows-1251",
    "iso-8859-2",
    "iso-8859-15",
    "macintosh",
    "ibm850",
    "utf-16le",
    "utf-16be",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub path: String,
    pub label: String,
    pub modified_ms: u64,
    pub size: u64,
}

pub fn decode_bytes(bytes: &[u8], encoding_label: &str) -> Result<String, String> {
    let label = encoding_label.trim();
    if label.eq_ignore_ascii_case("utf-8") || label.eq_ignore_ascii_case("utf8") {
        return Ok(String::from_utf8_lossy(bytes).into_owned());
    }
    let enc = encoding_rs::Encoding::for_label(label.as_bytes())
        .ok_or_else(|| format!("Unknown encoding: {label}"))?;
    let (cow, _, had_errors) = enc.decode(bytes);
    if had_errors {
        // Still return text — legacy files often have a few bad bytes.
        return Ok(cow.into_owned());
    }
    Ok(cow.into_owned())
}

pub fn parse_with_encoding(bytes: &[u8], encoding_label: &str) -> Result<Vec<Cue>, String> {
    Ok(subtitles::parse(&decode_bytes(bytes, encoding_label)?))
}

pub fn mtime_ms(path: &str) -> Result<u64, String> {
    let modified = fs::metadata(path).map_err(|e| e.to_string())?.modified().map_err(|e| e.to_string())?;
    Ok(system_time_ms(modified))
}

fn system_time_ms(t: SystemTime) -> u64 {
    t.duration_since(UNIX_EPOCH).unwrap_or(Duration::ZERO).as_millis() as u64
}

/// Reveal `path` in the file manager (Finder: `open -R`).
pub fn reveal_path(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(format!("Path not found: {path}"));
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", path])
            .status()
            .map_err(|e| e.to_string())?
            .success()
            .then_some(())
            .ok_or_else(|| "open -R failed".into())
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", path])
            .status()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let dir = if p.is_dir() {
            p.to_path_buf()
        } else {
            p.parent().unwrap_or(p).to_path_buf()
        };
        std::process::Command::new("xdg-open")
            .arg(&dir)
            .status()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

/// Open a folder (or file) with the OS default handler.
pub fn open_path(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(format!("Path not found: {path}"));
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .status()
            .map_err(|e| e.to_string())?
            .success()
            .then_some(())
            .ok_or_else(|| "open failed".into())
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .status()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .status()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

pub fn backup_dir(app_data: &Path) -> PathBuf {
    app_data.join(BACKUP_DIR)
}

fn sanitize_label(label: &str) -> String {
    let base = Path::new(label)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("untitled");
    base.chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .take(40)
        .collect()
}

pub fn write_auto_backup(
    app_data: &Path,
    label: &str,
    cues: &[Cue],
    format: SubtitleFormat,
    keep: usize,
) -> Result<String, String> {
    let dir = backup_dir(app_data);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let ext = match format {
        SubtitleFormat::Srt => "srt",
        SubtitleFormat::Vtt => "vtt",
    };
    let name = format!(
        "{}_{}.{}",
        system_time_ms(SystemTime::now()),
        sanitize_label(label),
        ext
    );
    let path = dir.join(&name);
    fs::write(&path, subtitles::serialize(cues, format)).map_err(|e| e.to_string())?;
    prune_backups(&dir, keep.max(1))?;
    Ok(path.to_string_lossy().into_owned())
}

pub fn list_backups(app_data: &Path) -> Result<Vec<BackupInfo>, String> {
    let dir = backup_dir(app_data);
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut items = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(ext) = path.extension().and_then(|e| e.to_str()) else { continue };
        if !matches!(ext.to_ascii_lowercase().as_str(), "srt" | "vtt") {
            continue;
        }
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        let modified = meta.modified().unwrap_or(UNIX_EPOCH);
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("backup");
        // Strip leading timestamp_ for display when present.
        let label = file_name
            .split_once('_')
            .map(|(_, rest)| rest.to_string())
            .unwrap_or_else(|| file_name.to_string());
        items.push(BackupInfo {
            path: path.to_string_lossy().into_owned(),
            label,
            modified_ms: system_time_ms(modified),
            size: meta.len(),
        });
    }
    items.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
    Ok(items)
}

fn prune_backups(dir: &Path, keep: usize) -> Result<(), String> {
    let mut files: Vec<_> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .collect();
    files.sort_by_key(|e| e.metadata().and_then(|m| m.modified()).unwrap_or(UNIX_EPOCH));
    files.reverse(); // newest first
    for old in files.into_iter().skip(keep) {
        let _ = fs::remove_file(old.path());
    }
    Ok(())
}

pub fn ensure_backup_dir(app_data: &Path) -> Result<String, String> {
    let dir = backup_dir(app_data);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::subtitles::Cue;

    #[test]
    fn decodes_windows_1252() {
        // "café" in windows-1252: c a f é(0xE9)
        let bytes = [b'c', b'a', b'f', 0xE9];
        let s = decode_bytes(&bytes, "windows-1252").unwrap();
        assert_eq!(s, "café");
    }

    #[test]
    fn rejects_unknown_encoding() {
        assert!(decode_bytes(b"hi", "not-an-encoding").is_err());
    }

    #[test]
    fn backup_round_trip_and_prune() {
        let dir = std::env::temp_dir().join(format!("substudio-backup-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let cues = vec![Cue { start: 0.0, end: 1.0, text: "Hi".into() }];
        for i in 0..5 {
            // stagger names via label so files differ; prune keep=2
            std::thread::sleep(Duration::from_millis(5));
            write_auto_backup(&dir, &format!("f{i}.srt"), &cues, SubtitleFormat::Srt, 2).unwrap();
        }
        let listed = list_backups(&dir).unwrap();
        assert!(listed.len() <= 2, "kept {}", listed.len());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn sanitize_strips_path_junk() {
        assert_eq!(sanitize_label("/tmp/My Film!!.srt"), "My_Film__");
    }
}
