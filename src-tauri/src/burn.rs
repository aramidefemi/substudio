//! Burn subtitles into a new video (DLV-01).
//!
//! The cues become a temporary ASS file that ffmpeg's libass `subtitles` filter
//! draws onto the picture. The original is only ever read: output goes to a
//! user-chosen `.mp4` via a `.partial` file. `-copyts` + `-fps_mode passthrough`
//! keep the source timestamps, so cue times (which refer to the source timeline)
//! line up with the frames they were authored against.

use crate::ffmpeg_bin;
use crate::formats::ass::{self, AssDocument, AssKind, AssStyle};
use crate::media::{self, MediaInfo};
use crate::subtitles::Cue;
use std::ffi::OsString;
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};

pub const CANCELLED: &str = "Cancelled";

/// Audio codecs the MP4 muxer takes as-is.
const MP4_AUDIO: [&str; 5] = ["aac", "mp3", "ac3", "eac3", "alac"];
const DEFAULT_BITRATE: u64 = 8_000_000;
const MIN_BITRATE: u64 = 2_000_000;
const MAX_BITRATE: u64 = 25_000_000;

#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BurnOutcome {
    pub path: String,
    pub encoder: &'static str,
}

#[derive(Debug, Clone, PartialEq)]
struct Plan {
    encoder: &'static str,
    bitrate: u64,
    audio_copy: bool,
}

/// Prefer hardware H.264; fall back to libx264 when the build has it.
fn pick_encoder(encoders: &str) -> Option<&'static str> {
    ["h264_videotoolbox", "libx264"]
        .into_iter()
        .find(|e| encoders.lines().any(|l| l.split_whitespace().nth(1) == Some(e)))
}

fn has_filter(filters: &str, name: &str) -> bool {
    filters.lines().any(|l| l.split_whitespace().nth(1) == Some(name))
}

/// Source bitrate clamped to a sensible range (burn-in must not balloon or starve).
fn target_bitrate(info: &MediaInfo) -> u64 {
    info.bit_rate
        .filter(|b| *b > 0)
        .map_or(DEFAULT_BITRATE, |b| b.clamp(MIN_BITRATE, MAX_BITRATE))
}

/// Stream-copy audio only when every track fits MP4; otherwise re-encode all to AAC.
fn audio_copyable(info: &MediaInfo) -> bool {
    let codecs: Vec<_> = info.tracks.iter().filter(|t| t.kind == "audio").collect();
    !codecs.is_empty()
        && codecs
            .iter()
            .all(|t| t.codec.as_deref().is_some_and(|c| MP4_AUDIO.contains(&c.to_ascii_lowercase().as_str())))
}

fn plan(info: &MediaInfo, encoder: &'static str) -> Plan {
    Plan { encoder, bitrate: target_bitrate(info), audio_copy: audio_copyable(info) }
}

/// Escape a path for use inside a single-quoted ffmpeg filter option value.
fn escape_filter_value(s: &str) -> String {
    s.replace('\\', "\\\\").replace('\'', "'\\\\\\''").replace(':', "\\:")
}

fn build_args(input: &Path, ass_path: &Path, out: &Path, p: &Plan) -> Vec<OsString> {
    let filter = format!(
        "subtitles=filename='{}',format=yuv420p",
        escape_filter_value(&ass_path.to_string_lossy())
    );
    let mut a: Vec<OsString> = ["-hide_banner", "-nostdin", "-y", "-copyts", "-i"].map(Into::into).into();
    a.push(input.into());
    let video: Vec<String> = if p.encoder == "libx264" {
        ["-c:v", "libx264", "-crf", "18", "-preset", "medium"].map(String::from).into()
    } else {
        ["-c:v", p.encoder, "-b:v", &p.bitrate.to_string(), "-allow_sw", "1"].map(String::from).into()
    };
    let audio: &[&str] = if p.audio_copy { &["-c:a", "copy"] } else { &["-c:a", "aac", "-b:a", "192k"] };
    a.extend(["-map", "0:v:0", "-map", "0:a?", "-sn", "-dn", "-vf"].map(OsString::from));
    a.push(filter.into());
    a.extend(video.into_iter().map(OsString::from));
    a.extend(audio.iter().map(OsString::from));
    a.extend(
        ["-fps_mode", "passthrough", "-tag:v", "avc1", "-movflags", "+faststart", "-f", "mp4", "-progress", "pipe:1", "-nostats"]
            .map(OsString::from),
    );
    a.push(out.into());
    a
}

/// Fraction done from an `out_time_us=` progress line (`-copyts` keeps the source start offset).
fn progress_fraction(line: &str, start: f64, duration: f64) -> Option<f32> {
    let us: f64 = line.strip_prefix("out_time_us=")?.trim().parse().ok()?;
    (duration > 0.05).then(|| (((us / 1e6 - start) / duration).clamp(0.0, 0.99)) as f32)
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

/// Output must be a different `.mp4` in an existing folder, so the source can never be touched.
fn check_dest(source: &Path, dest: &Path) -> Result<(), String> {
    let is_mp4 = dest.extension().is_some_and(|e| e.eq_ignore_ascii_case("mp4"));
    if !is_mp4 {
        return Err("Output must be an .mp4 file".into());
    }
    if same_file(source, dest) {
        return Err("Output must differ from the source video".into());
    }
    match dest.parent().filter(|d| !d.as_os_str().is_empty()) {
        Some(dir) if !dir.is_dir() => Err("Output folder does not exist".into()),
        _ => Ok(()),
    }
}

fn ass_text(cues: &[Cue], styles: Option<&[AssStyle]>) -> String {
    ass::serialize(&AssDocument {
        kind: AssKind::Ass,
        styles: styles.map(<[_]>::to_vec).unwrap_or_default(),
        cues: cues.to_vec(),
    })
}

fn ffmpeg_listing(ffmpeg: &Path, flag: &str) -> String {
    Command::new(ffmpeg)
        .args(["-hide_banner", flag])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
        .unwrap_or_default()
}

/// Temp file removed on drop (success, error or cancel).
struct Scratch(PathBuf);
impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

fn tail(s: &str, max: usize) -> &str {
    let start = s.len().saturating_sub(max);
    let start = (start..=s.len()).find(|i| s.is_char_boundary(*i)).unwrap_or(s.len());
    s[start..].trim()
}

/// Burn `cues` into `source`, writing `dest`. Progress is 0–1; `cancel` aborts and cleans up.
pub fn burn(
    source: &str,
    dest: &str,
    cues: &[Cue],
    styles: Option<&[AssStyle]>,
    cancel: &AtomicBool,
    mut progress: impl FnMut(f32),
) -> Result<BurnOutcome, String> {
    let (src, out) = (Path::new(source), Path::new(dest));
    if !src.is_file() {
        return Err("Video file not found".into());
    }
    if cues.is_empty() {
        return Err("No subtitles to burn in".into());
    }
    check_dest(src, out)?;

    let ffmpeg = ffmpeg_bin::find_ffmpeg().ok_or("ffmpeg not found")?;
    if !has_filter(&ffmpeg_listing(&ffmpeg, "-filters"), "subtitles") {
        return Err("This ffmpeg build has no subtitle renderer (libass). Rebuild the sidecar with scripts/fetch-ffmpeg.sh.".into());
    }
    let encoder = pick_encoder(&ffmpeg_listing(&ffmpeg, "-encoders")).ok_or("No H.264 encoder available in this ffmpeg build")?;
    let info = media::probe(source)?;
    let plan = plan(&info, encoder);

    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_nanos());
    let ass_file = Scratch(std::env::temp_dir().join(format!("substudio-burn-{}-{nanos}.ass", std::process::id())));
    fs::write(&ass_file.0, ass_text(cues, styles)).map_err(|e| e.to_string())?;
    let partial = Scratch(out.with_extension("mp4.partial"));

    let mut child = Command::new(&ffmpeg)
        .args(build_args(src, &ass_file.0, &partial.0, &plan))
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
        return Err(format!("ffmpeg burn-in failed ({status}): {}", tail(&log, 600)));
    }
    fs::rename(&partial.0, out).map_err(|e| e.to_string())?;
    progress(1.0);
    Ok(BurnOutcome { path: dest.to_string(), encoder })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media::MediaTrack;

    fn info(bit_rate: Option<u64>, audio: &[&str]) -> MediaInfo {
        MediaInfo {
            path: "/a.mkv".into(),
            file_name: "a.mkv".into(),
            size_bytes: 1,
            modified_ms: None,
            container: None,
            duration_secs: Some(10.0),
            bit_rate,
            width: None,
            height: None,
            frame_rate: None,
            fps: None,
            start_time_secs: Some(0.0),
            variable_frame_rate: None,
            frame_count: None,
            tracks: audio
                .iter()
                .enumerate()
                .map(|(i, c)| MediaTrack { index: i as _, kind: "audio".into(), codec: Some((*c).into()), language: None, detail: None })
                .collect(),
            source: "ffprobe".into(),
            note: None,
        }
    }

    #[test]
    fn encoder_prefers_hardware() {
        let both = " V....D libx264              x\n V....D h264_videotoolbox    y\n";
        assert_eq!(pick_encoder(both), Some("h264_videotoolbox"));
        assert_eq!(pick_encoder(" V....D libx264  x\n"), Some("libx264"));
        assert_eq!(pick_encoder(" V....D libx265  x\n"), None);
    }

    #[test]
    fn filter_lookup_is_exact() {
        let f = " T.. subtitles        V->V       Render text subtitles\n ... asubboost A->A x\n";
        assert!(has_filter(f, "subtitles"));
        assert!(!has_filter(f, "ass"));
    }

    #[test]
    fn bitrate_is_clamped() {
        assert_eq!(target_bitrate(&info(None, &[])), DEFAULT_BITRATE);
        assert_eq!(target_bitrate(&info(Some(500_000), &[])), MIN_BITRATE);
        assert_eq!(target_bitrate(&info(Some(80_000_000), &[])), MAX_BITRATE);
        assert_eq!(target_bitrate(&info(Some(6_000_000), &[])), 6_000_000);
    }

    #[test]
    fn audio_copy_needs_every_track_mp4_safe() {
        assert!(audio_copyable(&info(None, &["aac", "AC3"])));
        assert!(!audio_copyable(&info(None, &["aac", "opus"])));
        assert!(!audio_copyable(&info(None, &[])));
    }

    #[test]
    fn filter_value_escapes_specials() {
        assert_eq!(escape_filter_value("/t/a:b.ass"), "/t/a\\:b.ass");
        assert_eq!(escape_filter_value("C:\\x"), "C\\:\\\\x");
        assert_eq!(escape_filter_value("it's"), "it'\\\\\\''s");
    }

    #[test]
    fn args_keep_timeline_and_never_target_source() {
        let p = Plan { encoder: "h264_videotoolbox", bitrate: 6_000_000, audio_copy: true };
        let a: Vec<String> = build_args(Path::new("/in.mkv"), Path::new("/t/s.ass"), Path::new("/o.mp4.partial"), &p)
            .iter()
            .map(|s| s.to_string_lossy().into_owned())
            .collect();
        let has = |x: &str| a.iter().any(|s| s == x);
        assert!(has("-copyts") && has("passthrough") && has("copy") && has("h264_videotoolbox"));
        assert!(!a.iter().any(|s| s.contains("setpts") || s == "-r"));
        assert_eq!(a.last().unwrap(), "/o.mp4.partial");
        assert_eq!(a.iter().filter(|s| *s == "/in.mkv").count(), 1);
        assert!(a.iter().any(|s| s == "subtitles=filename='/t/s.ass',format=yuv420p"));
    }

    #[test]
    fn args_switch_codecs_by_plan() {
        let p = Plan { encoder: "libx264", bitrate: 1, audio_copy: false };
        let a: Vec<String> = build_args(Path::new("/i"), Path::new("/s"), Path::new("/o"), &p)
            .iter()
            .map(|s| s.to_string_lossy().into_owned())
            .collect();
        assert!(a.contains(&"-crf".to_string()) && a.contains(&"aac".to_string()));
        assert!(!a.contains(&"copy".to_string()) && !a.contains(&"-b:v".to_string()));
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
    fn dest_guards() {
        let dir = std::env::temp_dir().join(format!("substudio-burn-guard-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let src = dir.join("film.mp4");
        fs::write(&src, b"x").unwrap();
        assert!(check_dest(&src, &src).unwrap_err().contains("differ"));
        assert!(check_dest(&src, &dir.join("./film.mp4")).unwrap_err().contains("differ"));
        assert!(check_dest(&src, &dir.join("film.mkv")).unwrap_err().contains(".mp4"));
        assert!(check_dest(&src, &dir.join("nope/out.mp4")).unwrap_err().contains("folder"));
        assert!(check_dest(&src, &dir.join("film.burned.MP4")).is_ok());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn ass_uses_default_style_when_none_given() {
        let cues = [Cue { start: 1.0, end: 2.0, text: "Ẹ ṣé".into(), style: None }];
        let t = ass_text(&cues, None);
        assert!(t.contains("Style: Default") && t.contains("Ẹ ṣé") && t.contains("0:00:01.00"));
    }

    #[test]
    fn tail_keeps_char_boundaries() {
        assert_eq!(tail("héllo wörld", 4), "rld");
        assert_eq!(tail("short", 100), "short");
    }

    #[test]
    fn burns_when_ffmpeg_has_libass() {
        let Some(ffmpeg) = ffmpeg_bin::find_ffmpeg() else { return };
        if !has_filter(&ffmpeg_listing(&ffmpeg, "-filters"), "subtitles") || pick_encoder(&ffmpeg_listing(&ffmpeg, "-encoders")).is_none() {
            eprintln!("skipping: ffmpeg lacks libass or an H.264 encoder");
            return;
        }
        let dir = std::env::temp_dir().join(format!("substudio-burn-it-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let src = dir.join("src.mp4");
        let ok = Command::new(&ffmpeg)
            .args(["-hide_banner", "-y", "-f", "lavfi", "-i", "color=c=blue:s=320x240:d=1", "-f", "lavfi", "-i", "sine=d=1", "-pix_fmt", "yuv420p", "-shortest"])
            .arg(&src)
            .status()
            .is_ok_and(|s| s.success());
        if !ok {
            let _ = fs::remove_dir_all(&dir);
            eprintln!("skipping: could not build fixture");
            return;
        }
        let before = fs::read(&src).unwrap();
        let out = dir.join("burned.mp4");
        let cues = [Cue { start: 0.2, end: 0.8, text: "Hello".into(), style: None }];
        let mut last = 0.0;
        let res = burn(src.to_str().unwrap(), out.to_str().unwrap(), &cues, None, &AtomicBool::new(false), |p| last = p).unwrap();
        assert!(out.is_file() && res.path == out.to_string_lossy());
        assert_eq!(last, 1.0);
        assert_eq!(fs::read(&src).unwrap(), before, "source untouched");
        assert!(!out.with_extension("mp4.partial").exists());
        let _ = fs::remove_dir_all(&dir);
    }
}
