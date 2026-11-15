//! YouTube SubViewer (`.sbv`) parse + serialize.
//!
//! **Public API (for orchestrator / sibling agents):**
//! - [`parse`] / [`serialize`] — same cue model as SRT/VTT (`crate::subtitles::Cue`,
//!   times as seconds `f64`).
//! - [`looks_like_sbv`] — heuristic for auto-detect before dispatch.
//! - [`EXTENSIONS`] — `["sbv"]`.
//!
//! **Wire-up remaining (orchestrator):** add `SubtitleFormat::Sbv`, dispatch in
//! `subtitles::parse` / `serialize` and `files` (extension → format), Tauri
//! open/save filters, and frontend commands/types. Do not merge ASS here.
//!
//! **Format:** timing line `H:MM:SS.mmm,H:MM:SS.mmm` (comma, not `-->`), then
//! one or more text lines, blank line between cues. No cue indices. Invalid
//! blocks are skipped (same error style as SRT/VTT — no `Result`).

#![allow(dead_code)] // public API; SubtitleFormat dispatch is orchestrator-owned

use crate::subtitles::Cue;

/// File extensions this module owns (lowercase, no dot).
pub const EXTENSIONS: &[&str] = &["sbv"];

/// True when the text looks like YouTube SBV (timing with `,`, no `-->`).
pub fn looks_like_sbv(input: &str) -> bool {
    let text = strip_bom(input);
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if line.contains("-->") {
            return false;
        }
        if parse_timing(line).is_some() {
            return true;
        }
        // First non-empty non-timing line → not SBV.
        return false;
    }
    false
}

/// Parse YouTube SBV into cues sorted by `start`. Skips blocks without a valid timing line.
pub fn parse(input: &str) -> Vec<Cue> {
    let text = strip_bom(input).replace("\r\n", "\n").replace('\r', "\n");
    let mut cues = Vec::new();

    for block in text.split("\n\n") {
        let mut lines = block.lines().map(str::trim_end).filter(|l| !l.is_empty());
        let Some(timing) = lines.next() else { continue };
        let Some((start, end)) = parse_timing(timing.trim()) else { continue };
        let body: Vec<&str> = lines.collect();
        if body.is_empty() {
            continue;
        }
        cues.push(Cue {
            start,
            end,
            text: body.join("\n"),
        });
    }

    cues.sort_by(|a, b| a.start.total_cmp(&b.start));
    cues
}

/// Serialize cues as YouTube SBV (`H:MM:SS.mmm,H:MM:SS.mmm` + text + blank line).
pub fn serialize(cues: &[Cue]) -> String {
    let mut out = String::new();
    for cue in cues {
        out.push_str(&format_time(cue.start));
        out.push(',');
        out.push_str(&format_time(cue.end));
        out.push('\n');
        out.push_str(&cue.text);
        out.push_str("\n\n");
    }
    out
}

fn strip_bom(s: &str) -> &str {
    s.trim_start_matches('\u{feff}')
}

/// `H:MM:SS.mmm,H:MM:SS.mmm` — hours may be 1+ digits; ms may be 1–3 digits.
fn parse_timing(line: &str) -> Option<(f64, f64)> {
    let (left, right) = line.split_once(',')?;
    // Reject SRT-style or extra trailing junk after end time.
    let right = right.trim();
    if right.contains(',') || right.contains(' ') {
        return None;
    }
    Some((parse_time(left.trim())?, parse_time(right)?))
}

fn parse_time(s: &str) -> Option<f64> {
    let parts: Vec<&str> = s.split(':').collect();
    let (h, m, sec) = match parts.as_slice() {
        [h, m, sec] => (
            h.parse::<f64>().ok()?,
            m.parse::<f64>().ok()?,
            sec.parse::<f64>().ok()?,
        ),
        [m, sec] => (0.0, m.parse::<f64>().ok()?, sec.parse::<f64>().ok()?),
        _ => return None,
    };
    Some(h * 3600.0 + m * 60.0 + sec)
}

fn format_time(t: f64) -> String {
    let total_ms = (t.max(0.0) * 1000.0).round() as u64;
    let (ms, total_s) = (total_ms % 1000, total_ms / 1000);
    let s = total_s % 60;
    let total_m = total_s / 60;
    let m = total_m % 60;
    let h = total_m / 60;
    format!("{h}:{m:02}:{s:02}.{ms:03}")
}

#[cfg(test)]
mod tests {
    use super::*;

    const DIALOGUE: &str = include_str!("fixtures/dialogue.sbv");
    const MULTILINE: &str = include_str!("fixtures/multiline.sbv");

    #[test]
    fn detects_sbv_not_srt() {
        assert!(looks_like_sbv(DIALOGUE));
        assert!(!looks_like_sbv(
            "1\n00:00:00,000 --> 00:00:01,000\nHi\n"
        ));
        assert!(!looks_like_sbv("[Script Info]\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hi\n"));
    }

    #[test]
    fn parses_common_dialogue() {
        let cues = parse(DIALOGUE);
        assert_eq!(cues.len(), 3);
        assert_eq!(cues[0].start, 0.0);
        assert_eq!(cues[0].end, 1.547);
        assert_eq!(cues[0].text, "The right side, you can see.");
        assert_eq!(cues[1].start, 1.547);
        assert_eq!(cues[1].end, 3.2);
        assert_eq!(cues[1].text, "What is what?");
        assert_eq!(cues[2].start, 3905.5);
        assert_eq!(cues[2].end, 3907.0);
        assert_eq!(cues[2].text, "One hour later.");
    }

    #[test]
    fn parses_bom_crlf_and_multiline() {
        let raw = format!("\u{feff}{}", MULTILINE.replace('\n', "\r\n"));
        let cues = parse(&raw);
        assert_eq!(cues.len(), 2);
        assert_eq!(cues[0].text, "Line one\nLine two");
        assert_eq!(cues[1].text, "Single.");
        assert!((cues[0].start - 0.32).abs() < 0.0001);
        assert!((cues[0].end - 1.76).abs() < 0.0001);
    }

    #[test]
    fn skips_broken_blocks() {
        let cues = parse(
            "not a timing\nText\n\n0:00:01.000,0:00:02.000\nOk\n\n0:00:03.000,bad\nNope\n",
        );
        assert_eq!(cues, vec![Cue {
            start: 1.0,
            end: 2.0,
            text: "Ok".into(),
        }]);
    }

    #[test]
    fn round_trips_dialogue() {
        let cues = parse(DIALOGUE);
        let out = serialize(&cues);
        assert_eq!(parse(&out), cues);
        assert!(out.starts_with("0:00:00.000,0:00:01.547\n"));
        assert!(out.contains("\n\n1:05:05.500,1:05:07.000\nOne hour later.\n\n"));
    }

    #[test]
    fn round_trips_multiline() {
        let cues = parse(MULTILINE);
        assert_eq!(parse(&serialize(&cues)), cues);
    }

    #[test]
    fn writes_canonical_times() {
        let out = serialize(&[Cue {
            start: 3661.5,
            end: 3662.0,
            text: "Hi".into(),
        }]);
        assert_eq!(out, "1:01:01.500,1:01:02.000\nHi\n\n");
    }

    #[test]
    fn times_accept_short_hours_and_mm_ss() {
        assert_eq!(parse_time("0:00:01.500"), Some(1.5));
        assert_eq!(parse_time("1:02:03.450"), Some(3723.45));
        assert_eq!(parse_time("01.500"), None); // need at least m:s
        assert_eq!(parse_time("1:02.5"), Some(62.5));
        assert_eq!(format_time(1.5), "0:00:01.500");
        assert_eq!(format_time(3723.45), "1:02:03.450");
    }
}
