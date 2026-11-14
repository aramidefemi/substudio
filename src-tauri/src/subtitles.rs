//! Reading and writing subtitle files. Times are seconds as `f64`; the
//! frontend owns display formats (frames vs milliseconds).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Cue {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SubtitleFormat {
    Srt,
    Vtt,
}

/// Parses SubRip or WebVTT text. Blocks without a valid `-->` timing line are skipped.
pub fn parse(input: &str) -> Vec<Cue> {
    let text = input.trim_start_matches('\u{feff}').replace("\r\n", "\n").replace('\r', "\n");
    let mut cues = Vec::new();

    for block in text.split("\n\n") {
        let mut lines = block.lines().skip_while(|l| !l.contains("-->"));
        let Some(timing) = lines.next() else { continue };
        let Some((start, end)) = parse_timing(timing) else { continue };
        let body: Vec<&str> = lines.collect();
        cues.push(Cue { start, end, text: body.join("\n").trim().to_string() });
    }

    cues.sort_by(|a, b| a.start.total_cmp(&b.start));
    cues
}

pub fn serialize(cues: &[Cue], format: SubtitleFormat) -> String {
    let mut out = String::new();
    if format == SubtitleFormat::Vtt {
        out.push_str("WEBVTT\n\n");
    }
    for (i, cue) in cues.iter().enumerate() {
        let sep = if format == SubtitleFormat::Srt { ',' } else { '.' };
        if format == SubtitleFormat::Srt {
            out.push_str(&format!("{}\n", i + 1));
        }
        out.push_str(&format!(
            "{} --> {}\n{}\n\n",
            format_time(cue.start, sep),
            format_time(cue.end, sep),
            cue.text
        ));
    }
    out
}

fn parse_timing(line: &str) -> Option<(f64, f64)> {
    let (left, right) = line.split_once("-->")?;
    // WebVTT may put cue settings after the end time ("00:01.000 align:start").
    let right = right.split_whitespace().next()?;
    Some((parse_time(left.trim())?, parse_time(right)?))
}

/// Accepts `hh:mm:ss,mmm`, `hh:mm:ss.mmm` and `mm:ss.mmm`.
fn parse_time(s: &str) -> Option<f64> {
    let s = s.replace(',', ".");
    let parts: Vec<&str> = s.split(':').collect();
    let (h, m, sec) = match parts.as_slice() {
        [h, m, sec] => (h.parse::<f64>().ok()?, m.parse::<f64>().ok()?, sec.parse::<f64>().ok()?),
        [m, sec] => (0.0, m.parse::<f64>().ok()?, sec.parse::<f64>().ok()?),
        _ => return None,
    };
    Some(h * 3600.0 + m * 60.0 + sec)
}

fn format_time(t: f64, sep: char) -> String {
    let total_ms = (t.max(0.0) * 1000.0).round() as u64;
    let (ms, total_s) = (total_ms % 1000, total_ms / 1000);
    format!("{:02}:{:02}:{:02}{}{:03}", total_s / 3600, total_s % 3600 / 60, total_s % 60, sep, ms)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SRT: &str = "\u{feff}1\r\n00:00:00,320 --> 00:00:01,760\r\nThe right side, you can see.\r\n\r\n2\r\n00:00:02,279 --> 00:00:03,098\r\nWhat is\r\nwhat?\r\n";

    #[test]
    fn parses_srt_with_bom_and_crlf() {
        let cues = parse(SRT);
        assert_eq!(cues.len(), 2);
        assert_eq!(cues[0].start, 0.32);
        assert_eq!(cues[0].end, 1.76);
        assert_eq!(cues[1].text, "What is\nwhat?");
    }

    #[test]
    fn parses_vtt_short_times_and_settings() {
        let cues = parse("WEBVTT\n\n00:01.500 --> 00:03.000 align:start\nHello\n");
        assert_eq!(cues, vec![Cue { start: 1.5, end: 3.0, text: "Hello".into() }]);
    }

    #[test]
    fn skips_broken_blocks() {
        assert!(parse("1\nnot a timing line\nText\n").is_empty());
    }

    #[test]
    fn srt_round_trips() {
        let cues = parse(SRT);
        assert_eq!(parse(&serialize(&cues, SubtitleFormat::Srt)), cues);
        assert!(serialize(&cues, SubtitleFormat::Srt).starts_with("1\n00:00:00,320 --> 00:00:01,760\n"));
    }

    #[test]
    fn writes_vtt() {
        let out = serialize(&[Cue { start: 3661.5, end: 3662.0, text: "Hi".into() }], SubtitleFormat::Vtt);
        assert_eq!(out, "WEBVTT\n\n01:01:01.500 --> 01:01:02.000\nHi\n\n");
    }
}
