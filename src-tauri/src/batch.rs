//! Batch convert (DLV-03): many subtitle files → one format in an output folder.
//! Each file is read with encoding detection, optionally shifted, and re-serialized.
//! One bad file never stops the batch.

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::files;
use crate::subtitles::{self, Cue, SubtitleFormat};

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Failure {
    pub path: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BatchOutcome {
    /// Output paths that were written, in input order.
    pub ok: Vec<String>,
    pub failed: Vec<Failure>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchProgress {
    pub done: usize,
    pub total: usize,
    pub name: String,
}

/// Subtitle files directly inside `dir`, sorted by name (not recursive).
pub fn list_subtitle_files(dir: &Path) -> Result<Vec<String>, String> {
    let mut paths: Vec<String> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|p| p.is_file() && is_subtitle(p))
        .map(|p| p.to_string_lossy().into_owned())
        .collect();
    paths.sort_by_key(|p| p.to_lowercase());
    Ok(paths)
}

fn is_subtitle(path: &Path) -> bool {
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    !name.starts_with('.') && subtitles::EXTENSIONS.contains(&ext.as_str())
}

/// `stem.ext`, or `stem (2).ext` when that name is already `taken` (case-insensitive, like macOS).
fn unique_name(stem: &str, ext: &str, taken: &mut HashSet<String>) -> String {
    let name = (1..)
        .map(|n| if n == 1 { format!("{stem}.{ext}") } else { format!("{stem} ({n}).{ext}") })
        .find(|name| !taken.contains(&name.to_lowercase()))
        .expect("unbounded range");
    taken.insert(name.to_lowercase());
    name
}

fn shift(cues: Vec<Cue>, offset_ms: i64) -> Vec<Cue> {
    let d = offset_ms as f64 / 1000.0;
    cues.into_iter()
        .map(|c| {
            let start = (c.start + d).max(0.0);
            Cue { start, end: (c.end + d).max(start), ..c }
        })
        .collect()
}

fn convert_one(input: &Path, output: &Path, format: SubtitleFormat, offset_ms: i64) -> Result<(), String> {
    if output == input {
        return Err("Output would overwrite the source file".into());
    }
    let bytes = fs::read(input).map_err(|e| e.to_string())?;
    let parsed = files::parse_auto(&bytes);
    if parsed.cues.is_empty() {
        return Err("No subtitles found in this file".into());
    }
    let cues = shift(parsed.cues, offset_ms);
    let body = subtitles::serialize_with_styles(&cues, format, parsed.styles.as_deref());
    fs::write(output, body).map_err(|e| e.to_string())
}

/// Converts each of `inputs` into `out_dir` as `<name>.<format>`; `on_progress` fires after each file.
pub fn convert_files(
    inputs: &[String],
    format: SubtitleFormat,
    out_dir: &Path,
    offset_ms: i64,
    mut on_progress: impl FnMut(BatchProgress),
) -> Result<BatchOutcome, String> {
    fs::create_dir_all(out_dir).map_err(|e| format!("Could not create output folder: {e}"))?;
    let mut taken = HashSet::new();
    let mut outcome = BatchOutcome { ok: vec![], failed: vec![] };
    for (i, path) in inputs.iter().enumerate() {
        let input = Path::new(path);
        let stem = input.file_stem().and_then(|s| s.to_str()).unwrap_or("subtitles");
        let output: PathBuf = out_dir.join(unique_name(stem, format.extension(), &mut taken));
        match convert_one(input, &output, format, offset_ms) {
            Ok(()) => outcome.ok.push(output.to_string_lossy().into_owned()),
            Err(error) => outcome.failed.push(Failure { path: path.clone(), error }),
        }
        on_progress(BatchProgress {
            done: i + 1,
            total: inputs.len(),
            name: input.file_name().and_then(|n| n.to_str()).unwrap_or("").into(),
        });
    }
    Ok(outcome)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SRT: &str = "1\n00:00:01,000 --> 00:00:02,500\nHello\n\n2\n00:00:03,000 --> 00:00:04,000\nBye\n";

    fn scratch(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("substudio-batch-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn run(inputs: &[String], format: SubtitleFormat, out: &Path, offset_ms: i64) -> BatchOutcome {
        convert_files(inputs, format, out, offset_ms, |_| {}).unwrap()
    }

    #[test]
    fn converts_srt_and_sbv_fixtures_to_vtt() {
        let dir = scratch("vtt");
        let srt = dir.join("a.srt");
        fs::write(&srt, SRT).unwrap();
        let sbv = format!("{}/src/formats/fixtures/dialogue.sbv", env!("CARGO_MANIFEST_DIR"));
        let out = dir.join("out");
        let outcome = run(&[srt.to_string_lossy().into(), sbv], SubtitleFormat::Vtt, &out, 0);

        assert!(outcome.failed.is_empty(), "{:?}", outcome.failed);
        assert_eq!(outcome.ok.len(), 2);
        let a = fs::read_to_string(out.join("a.vtt")).unwrap();
        assert!(a.starts_with("WEBVTT"));
        assert!(a.contains("00:00:01.000 --> 00:00:02.500\nHello"));
        let b = fs::read_to_string(out.join("dialogue.vtt")).unwrap();
        assert!(b.contains("00:00:01.547 --> 00:00:03.200\nWhat is what?"));
    }

    #[test]
    fn converts_ttml_fixture_to_srt() {
        let dir = scratch("srt");
        let ttml = format!("{}/src/formats/fixtures/dialogue.ttml", env!("CARGO_MANIFEST_DIR"));
        let outcome = run(&[ttml], SubtitleFormat::Srt, &dir, 0);
        assert!(outcome.failed.is_empty(), "{:?}", outcome.failed);
        let body = fs::read_to_string(dir.join("dialogue.srt")).unwrap();
        assert!(body.starts_with("1\n00:00:00,"), "{body}");
    }

    #[test]
    fn applies_offset_and_clamps_at_zero() {
        let dir = scratch("offset");
        let srt = dir.join("a.srt");
        fs::write(&srt, SRT).unwrap();
        let out = dir.join("out");
        run(&[srt.to_string_lossy().into()], SubtitleFormat::Srt, &out, -1500);
        let body = fs::read_to_string(out.join("a.srt")).unwrap();
        assert!(body.contains("00:00:00,000 --> 00:00:01,000\nHello"), "{body}");
        assert!(body.contains("00:00:01,500 --> 00:00:02,500\nBye"), "{body}");
    }

    #[test]
    fn reports_failures_and_keeps_going() {
        let dir = scratch("fail");
        let good = dir.join("good.srt");
        let junk = dir.join("junk.srt");
        fs::write(&good, SRT).unwrap();
        fs::write(&junk, "not a subtitle file").unwrap();
        let missing = dir.join("missing.srt");
        let inputs: Vec<String> = [&junk, &missing, &good].iter().map(|p| p.to_string_lossy().into()).collect();
        let mut steps = vec![];
        let out = dir.join("out");
        let outcome = convert_files(&inputs, SubtitleFormat::Vtt, &out, 0, |p| steps.push(p.done)).unwrap();

        assert_eq!(outcome.ok.len(), 1);
        assert_eq!(outcome.failed.len(), 2);
        assert_eq!(outcome.failed[0].error, "No subtitles found in this file");
        assert_eq!(steps, [1, 2, 3]);
    }

    #[test]
    fn never_overwrites_the_source() {
        let dir = scratch("self");
        let srt = dir.join("a.srt");
        fs::write(&srt, SRT).unwrap();
        let outcome = run(&[srt.to_string_lossy().into()], SubtitleFormat::Srt, &dir, 0);
        assert!(outcome.ok.is_empty());
        assert_eq!(outcome.failed[0].error, "Output would overwrite the source file");
        assert_eq!(fs::read_to_string(&srt).unwrap(), SRT);
    }

    #[test]
    fn same_basename_inputs_get_distinct_outputs() {
        let dir = scratch("dupe");
        let (one, two) = (dir.join("a.srt"), dir.join("a.vtt"));
        fs::write(&one, SRT).unwrap();
        fs::write(&two, "WEBVTT\n\n00:01.000 --> 00:02.000\nHi\n").unwrap();
        let out = dir.join("out");
        let outcome = run(&[one.to_string_lossy().into(), two.to_string_lossy().into()], SubtitleFormat::Ass, &out, 0);
        assert_eq!(outcome.ok.len(), 2);
        assert!(out.join("a.ass").exists() && out.join("a (2).ass").exists());
    }

    #[test]
    fn lists_only_subtitle_files_sorted() {
        let dir = scratch("list");
        for name in ["b.srt", "A.VTT", "notes.txt", ".hidden.srt", "c.mp4"] {
            fs::write(dir.join(name), "").unwrap();
        }
        fs::create_dir(dir.join("sub.srt")).unwrap();
        let names: Vec<String> = list_subtitle_files(&dir)
            .unwrap()
            .iter()
            .map(|p| Path::new(p).file_name().unwrap().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, ["A.VTT", "b.srt"]);
    }
}
