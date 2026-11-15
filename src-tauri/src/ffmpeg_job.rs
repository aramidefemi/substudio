//! Shared plumbing for ffmpeg jobs that write a new video next to a source (DLV-01 burn, DLV-02 mux).
//!
//! The source is only ever read: output goes to `<out>.partial` and is renamed on success,
//! the temp files vanish on drop, and a cancel flag kills ffmpeg mid-run.

use crate::media::MediaInfo;
use std::ffi::OsString;
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};

pub const CANCELLED: &str = "Cancelled";

/// File removed on drop (success, error or cancel).
pub struct Scratch(pub PathBuf);
impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

/// Unique temp path, e.g. `substudio-burn-<pid>-<nanos>.ass`.
pub fn scratch_path(tag: &str, ext: &str) -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_nanos());
    std::env::temp_dir().join(format!("substudio-{tag}-{}-{nanos}.{ext}", std::process::id()))
}

/// `film.mp4` → `film.mp4.partial`.
pub fn partial_path(out: &Path) -> PathBuf {
    let mut s: OsString = out.into();
    s.push(".partial");
    s.into()
}

fn same_file(a: &Path, b: &Path) -> bool {
    let canon = |p: &Path| {
        let parent = p.parent().filter(|d| !d.as_os_str().is_empty()).unwrap_or(Path::new("."));
        fs::canonicalize(parent).ok().zip(p.file_name()).map(|(d, n)| d.join(n))
    };
    match (canon(a), canon(b)) {
        (Some(x), Some(y)) => x == y,
        _ => a == b,
    }
}

/// Output must have one of `exts`, differ from the source and sit in an existing folder.
pub fn check_dest(source: &Path, dest: &Path, exts: &[&str]) -> Result<(), String> {
    if !dest.extension().is_some_and(|e| exts.iter().any(|x| e.eq_ignore_ascii_case(x))) {
        let list: Vec<_> = exts.iter().map(|e| format!(".{e}")).collect();
        return Err(format!("Output must be {}", list.join(" / ")));
    }
    if same_file(source, dest) {
        return Err("Output must differ from the source video".into());
    }
    match dest.parent().filter(|d| !d.as_os_str().is_empty()) {
        Some(dir) if !dir.is_dir() => Err("Output folder does not exist".into()),
        _ => Ok(()),
    }
}

pub fn tail(s: &str, max: usize) -> &str {
    let start = s.len().saturating_sub(max);
    let start = (start..=s.len()).find(|i| s.is_char_boundary(*i)).unwrap_or(s.len());
    s[start..].trim()
}

/// Fraction done from an `out_time_us=` progress line (`-copyts` keeps the source start offset).
fn progress_fraction(line: &str, start: f64, duration: f64) -> Option<f32> {
    let us: f64 = line.strip_prefix("out_time_us=")?.trim().parse().ok()?;
    (duration > 0.05).then(|| (((us / 1e6 - start) / duration).clamp(0.0, 0.99)) as f32)
}

/// Run ffmpeg (which must write to `partial` and print `-progress pipe:1`), then rename to `out`.
/// Progress is 0–1; `cancel` aborts. `what` names the job in the failure message.
pub fn run(
    ffmpeg: &Path,
    args: Vec<OsString>,
    partial: &Scratch,
    out: &Path,
    info: &MediaInfo,
    what: &str,
    cancel: &AtomicBool,
    mut progress: impl FnMut(f32),
) -> Result<(), String> {
    let mut child = Command::new(ffmpeg)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("could not start ffmpeg: {e}"))?;

    // Drain stderr on a thread so a full pipe can never stall ffmpeg.
    let mut stderr = child.stderr.take().ok_or("ffmpeg stderr missing")?;
    let log = std::thread::spawn(move || {
        let mut s = String::new();
        let _ = stderr.read_to_string(&mut s);
        s
    });

    let stdout = child.stdout.take().ok_or("ffmpeg stdout missing")?;
    let start = info.start_time_secs.unwrap_or(0.0);
    let duration = info.duration_secs.unwrap_or(0.0);
    let mut last = 0.0_f32;
    progress(0.0);
    for line in BufReader::new(stdout).lines().map_while(Result::ok) {
        if cancel.load(Ordering::Relaxed) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(CANCELLED.into());
        }
        if let Some(p) = progress_fraction(&line, start, duration).filter(|p| p - last >= 0.01) {
            last = p;
            progress(p);
        }
    }
    let status = child.wait().map_err(|e| e.to_string())?;
    let log = log.join().unwrap_or_default();
    if cancel.load(Ordering::Relaxed) {
        return Err(CANCELLED.into());
    }
    if !status.success() || !partial.0.is_file() {
        return Err(format!("ffmpeg {what} failed ({status}): {}", tail(&log, 600)));
    }
    fs::rename(&partial.0, out).map_err(|e| e.to_string())?;
    progress(1.0);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tail_keeps_char_boundaries() {
        assert_eq!(tail("héllo wörld", 4), "rld");
        assert_eq!(tail("short", 100), "short");
    }

    #[test]
    fn progress_subtracts_start_offset() {
        let p = progress_fraction("out_time_us=15000000", 10.0, 10.0).unwrap();
        assert!((p - 0.5).abs() < 1e-6);
        assert_eq!(progress_fraction("out_time_us=N/A", 0.0, 10.0), None);
        assert_eq!(progress_fraction("frame=3", 0.0, 10.0), None);
        assert_eq!(progress_fraction("out_time_us=1", 0.0, 0.0), None);
        assert_eq!(progress_fraction("out_time_us=99000000", 0.0, 10.0), Some(0.99));
    }

    #[test]
    fn partial_appends_suffix() {
        assert_eq!(partial_path(Path::new("/o/a.b.mkv")), Path::new("/o/a.b.mkv.partial"));
    }

    #[test]
    fn dest_guards() {
        let dir = std::env::temp_dir().join(format!("substudio-job-guard-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let src = dir.join("film.mp4");
        fs::write(&src, b"x").unwrap();
        let ok = ["mp4", "mkv"];
        assert!(check_dest(&src, &src, &ok).unwrap_err().contains("differ"));
        assert!(check_dest(&src, &dir.join("./film.mp4"), &ok).unwrap_err().contains("differ"));
        assert!(check_dest(&src, &dir.join("film.avi"), &ok).unwrap_err().contains(".mp4 / .mkv"));
        assert!(check_dest(&src, &dir.join("nope/out.mp4"), &ok).unwrap_err().contains("folder"));
        assert!(check_dest(&src, &dir.join("film.out.MKV"), &ok).is_ok());
        let _ = fs::remove_dir_all(&dir);
    }
}
