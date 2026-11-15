//! Embed the cues as a soft subtitle track in a new video (DLV-02).
//!
//! Video and audio are stream-copied (audio is re-encoded to AAC only when MP4/MOV can't
//! hold it); the cues become one extra text track. MP4/MOV take `mov_text` (plain text, fed
//! from SRT); MKV takes SRT, or ASS when the project has styles. The original is only ever
//! read: output goes to a user-chosen new file via a `.partial` file. `-copyts` keeps the
//! source timestamps, so cue times line up with the timeline they were authored against.

use crate::burn::audio_copyable;
use crate::ffmpeg_bin;
use crate::ffmpeg_job::{self, check_dest, partial_path, scratch_path, Scratch};
use crate::formats::ass::AssStyle;
use crate::media::{self, MediaInfo};
use crate::subtitles::{self, Cue, SubtitleFormat};
use std::ffi::OsString;
use std::fs;
use std::path::Path;
use std::sync::atomic::AtomicBool;

/// Output extensions the picker accepts (everything with a [`Target`]).
const EXTENSIONS: [&str; 4] = ["mp4", "m4v", "mov", "mkv"];

#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MuxOutcome {
    pub path: String,
    /// Subtitle codec written (`mov_text`, `srt` or `ass`).
    pub codec: &'static str,
}

/// How a container holds the subtitle track.
#[derive(Debug, Clone, Copy, PartialEq)]
struct Target {
    /// ffmpeg muxer name.
    format: &'static str,
    /// ffmpeg subtitle encoder.
    codec: &'static str,
    /// Subtitle file written for ffmpeg to read.
    text: SubtitleFormat,
    /// Its file extension.
    text_ext: &'static str,
    /// Any audio codec can be stream-copied (MP4/MOV only take a few).
    any_audio: bool,
}

/// Container for `dest`'s extension, or why it can't hold soft subtitles.
fn target_for(dest: &Path, styled: bool) -> Result<Target, String> {
    let ext = dest.extension().map(|e| e.to_string_lossy().to_ascii_lowercase()).unwrap_or_default();
    let mov_text = |format| Target { format, codec: "mov_text", text: SubtitleFormat::Srt, text_ext: "srt", any_audio: false };
    match ext.as_str() {
        "mp4" | "m4v" => Ok(mov_text("mp4")),
        "mov" => Ok(mov_text("mov")),
        "mkv" if styled => Ok(Target { format: "matroska", codec: "ass", text: SubtitleFormat::Ass, text_ext: "ass", any_audio: true }),
        "mkv" => Ok(Target { format: "matroska", codec: "srt", text: SubtitleFormat::Srt, text_ext: "srt", any_audio: true }),
        _ => Err(format!(
            "{} can't hold soft subtitles. Choose {}.",
            if ext.is_empty() { "This file type".into() } else { format!(".{ext}") },
            EXTENSIONS.map(|e| format!(".{e}")).join(" / ")
        )),
    }
}

fn has_codec(info: &MediaInfo, kind: &str, codec: &str) -> bool {
    info.tracks
        .iter()
        .any(|t| t.kind == kind && t.codec.as_deref().is_some_and(|c| c.eq_ignore_ascii_case(codec)))
}

fn build_args(input: &Path, subs: &Path, out: &Path, t: &Target, info: &MediaInfo) -> Vec<OsString> {
    let mut a: Vec<OsString> = ["-hide_banner", "-nostdin", "-y", "-copyts", "-i"].map(Into::into).into();
    a.push(input.into());
    a.push("-i".into());
    a.push(subs.into());
    a.extend(["-map", "0:v:0", "-map", "0:a?", "-map", "1:0", "-map_metadata", "0", "-c:v", "copy"].map(OsString::from));
    let copy_audio = t.any_audio || audio_copyable(info);
    let audio: &[&str] = if copy_audio { &["-c:a", "copy"] } else { &["-c:a", "aac", "-b:a", "192k"] };
    a.extend(audio.iter().map(OsString::from));
    a.extend(["-c:s", t.codec].map(OsString::from));
    if t.format != "matroska" {
        // QuickTime/Apple players only recognise HEVC in MP4/MOV under `hvc1`.
        if has_codec(info, "video", "hevc") {
            a.extend(["-tag:v", "hvc1"].map(OsString::from));
        }
        a.extend(["-movflags", "+faststart"].map(OsString::from));
    }
    a.extend(["-f", t.format, "-progress", "pipe:1", "-nostats"].map(OsString::from));
    a.push(out.into());
    a
}

/// Embed `cues` as a soft subtitle track of `source`, writing `dest`. Progress is 0–1; `cancel` aborts.
pub fn mux(
    source: &str,
    dest: &str,
    cues: &[Cue],
    styles: Option<&[AssStyle]>,
    cancel: &AtomicBool,
    progress: impl FnMut(f32),
) -> Result<MuxOutcome, String> {
    let (src, out) = (Path::new(source), Path::new(dest));
    if !src.is_file() {
        return Err("Video file not found".into());
    }
    if cues.is_empty() {
        return Err("No subtitles to embed".into());
    }
    let target = target_for(out, styles.is_some_and(|s| !s.is_empty()))?;
    check_dest(src, out, &EXTENSIONS)?;

    let ffmpeg = ffmpeg_bin::find_ffmpeg().ok_or("ffmpeg not found")?;
    let info = media::probe(source)?;

    let subs = Scratch(scratch_path("mux", target.text_ext));
    fs::write(&subs.0, subtitles::serialize_with_styles(cues, target.text, styles)).map_err(|e| e.to_string())?;
    let partial = Scratch(partial_path(out));
    let args = build_args(src, &subs.0, &partial.0, &target, &info);
    ffmpeg_job::run(&ffmpeg, args, &partial, out, &info, "subtitle embed", cancel, progress)?;
    Ok(MuxOutcome { path: dest.to_string(), codec: target.codec })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media::MediaTrack;
    use std::process::Command;

    fn track(kind: &str, codec: &str) -> MediaTrack {
        MediaTrack { index: 0, kind: kind.into(), codec: Some(codec.into()), language: None, detail: None }
    }

    fn info(video: &str, audio: &[&str]) -> MediaInfo {
        MediaInfo {
            path: "/a.mkv".into(),
            file_name: "a.mkv".into(),
            size_bytes: 1,
            modified_ms: None,
            container: None,
            duration_secs: Some(10.0),
            bit_rate: None,
            width: None,
            height: None,
            frame_rate: None,
            fps: None,
            start_time_secs: Some(0.0),
            variable_frame_rate: None,
            frame_count: None,
            tracks: [track("video", video)].into_iter().chain(audio.iter().map(|c| track("audio", c))).collect(),
            source: "ffprobe".into(),
            note: None,
        }
    }

    fn args(dest: &str, styled: bool, i: &MediaInfo) -> Vec<String> {
        let t = target_for(Path::new(dest), styled).unwrap();
        build_args(Path::new("/in.mkv"), Path::new("/t/s.srt"), Path::new("/o.partial"), &t, i)
            .iter()
            .map(|s| s.to_string_lossy().into_owned())
            .collect()
    }

    #[test]
    fn extension_picks_codec() {
        let codec = |p, styled| target_for(Path::new(p), styled).map(|t| (t.format, t.codec, t.text));
        assert_eq!(codec("/o/a.mp4", false), Ok(("mp4", "mov_text", SubtitleFormat::Srt)));
        assert_eq!(codec("/o/a.M4V", true), Ok(("mp4", "mov_text", SubtitleFormat::Srt)));
        assert_eq!(codec("/o/a.mov", false), Ok(("mov", "mov_text", SubtitleFormat::Srt)));
        assert_eq!(codec("/o/a.mkv", false), Ok(("matroska", "srt", SubtitleFormat::Srt)));
        assert_eq!(codec("/o/a.mkv", true), Ok(("matroska", "ass", SubtitleFormat::Ass)));
    }

    #[test]
    fn unsupported_containers_say_so() {
        let err = |p| target_for(Path::new(p), false).unwrap_err();
        assert!(err("/o/a.avi").starts_with(".avi can't hold soft subtitles"));
        assert!(err("/o/a.avi").contains(".mp4 / .m4v / .mov / .mkv"));
        assert!(err("/o/noext").starts_with("This file type"));
    }

    #[test]
    fn mp4_args_copy_streams_and_convert_subs() {
        let a = args("/o.mp4", true, &info("h264", &["aac"]));
        let pair = |k: &str, v: &str| a.windows(2).any(|w| w[0] == k && w[1] == v);
        assert!(pair("-c:v", "copy") && pair("-c:a", "copy") && pair("-c:s", "mov_text") && pair("-f", "mp4"));
        assert!(pair("-map", "1:0") && pair("-movflags", "+faststart"));
        assert!(a.contains(&"-copyts".to_string()) && !a.contains(&"-tag:v".to_string()));
        assert_eq!(a.last().unwrap(), "/o.partial");
        assert_eq!(a.iter().filter(|s| *s == "/in.mkv").count(), 1);
    }

    #[test]
    fn mp4_reencodes_audio_it_cannot_hold_and_tags_hevc() {
        let a = args("/o.mov", false, &info("hevc", &["opus"]));
        assert!(a.windows(2).any(|w| w == ["-c:a", "aac"]));
        assert!(a.windows(2).any(|w| w == ["-tag:v", "hvc1"]));
    }

    #[test]
    fn mkv_copies_any_audio_and_skips_mp4_flags() {
        let a = args("/o.mkv", true, &info("hevc", &["opus", "dts"]));
        let pair = |k: &str, v: &str| a.windows(2).any(|w| w[0] == k && w[1] == v);
        assert!(pair("-c:a", "copy") && pair("-c:s", "ass") && pair("-f", "matroska"));
        assert!(!a.contains(&"-movflags".to_string()) && !a.contains(&"-tag:v".to_string()));
    }

    #[test]
    fn rejects_before_touching_anything() {
        let cue = [Cue { start: 0.0, end: 1.0, text: "x".into(), style: None }];
        let never = AtomicBool::new(false);
        let run = |src: &str, dest: &str, cues: &[Cue]| mux(src, dest, cues, None, &never, |_| {}).unwrap_err();
        assert!(run("/no/such.mp4", "/o.mp4", &cue).contains("not found"));
        let dir = std::env::temp_dir().join(format!("substudio-mux-guard-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let src = dir.join("film.mp4");
        fs::write(&src, b"x").unwrap();
        let s = src.to_str().unwrap();
        assert!(run(s, "/o.mp4", &[]).contains("No subtitles"));
        assert!(run(s, dir.join("o.avi").to_str().unwrap(), &cue).contains("can't hold"));
        assert!(run(s, s, &cue).contains("differ"));
        assert_eq!(fs::read(&src).unwrap(), b"x");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn embeds_track_when_ffmpeg_is_available() {
        let Some(ffmpeg) = ffmpeg_bin::find_ffmpeg() else { return };
        let dir = std::env::temp_dir().join(format!("substudio-mux-it-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let src = dir.join("src.mp4");
        let ok = Command::new(&ffmpeg)
            .args(["-hide_banner", "-y", "-f", "lavfi", "-i", "color=c=blue:s=320x240:d=1", "-f", "lavfi", "-i", "sine=d=1", "-c:v", "mpeg4", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest"])
            .arg(&src)
            .status()
            .is_ok_and(|s| s.success());
        if !ok {
            let _ = fs::remove_dir_all(&dir);
            eprintln!("skipping: could not build fixture");
            return;
        }
        let before = fs::read(&src).unwrap();
        let cues = [Cue { start: 0.2, end: 0.8, text: "Ẹ ṣé".into(), style: None }];
        for (name, codec) in [("a.mp4", "mov_text"), ("a.mov", "mov_text"), ("a.mkv", "srt")] {
            let out = dir.join(name);
            let mut last = 0.0;
            let res = mux(src.to_str().unwrap(), out.to_str().unwrap(), &cues, None, &AtomicBool::new(false), |p| last = p).unwrap();
            assert_eq!((res.codec, res.path.as_str()), (codec, out.to_str().unwrap()));
            assert_eq!(last, 1.0);
            assert!(!partial_path(&out).exists());
            let probed = media::probe(out.to_str().unwrap()).unwrap();
            assert!(probed.tracks.iter().any(|t| t.kind == "subtitle"), "{name}: no subtitle track");
            assert!(probed.tracks.iter().any(|t| t.kind == "video") && probed.tracks.iter().any(|t| t.kind == "audio"));
        }
        assert_eq!(fs::read(&src).unwrap(), before, "source untouched");
        let _ = fs::remove_dir_all(&dir);
    }
}
