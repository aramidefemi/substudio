//! Advanced SubStation Alpha (ASS) and SubStation Alpha (SSA) read/write.
//!
//! **Styles model (FMT-01):** styles travel with the document as a parallel list
//! (`AssDocument.styles`), not inside each cue's undo history. The frontend keeps
//! them in session state and passes them back on save. Cue `style` holds the
//! style *name* so Dialogue lines round-trip. SRT/VTT ignore both.
//!
//! Supports common Style fields (name, font, size, primary colour, bold/italic,
//! alignment). Drawing, karaoke, attachments, and font collector are out of scope.

use serde::{Deserialize, Serialize};

use crate::subtitles::Cue;

/// ASS (v4+) vs SSA (v4). Affects the Styles section header and Format line.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AssKind {
    Ass,
    Ssa,
}

/// Basic style fields we round-trip. Other ASS columns use sensible defaults.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssStyle {
    pub name: String,
    pub fontname: String,
    pub fontsize: f64,
    /// ASS `&HAABBGGRR` (or SSA decimal); stored as string for exact round-trip.
    pub primary_colour: String,
    pub bold: bool,
    pub italic: bool,
    /// Numpad alignment (1–9). Default 2 (bottom-centre).
    pub alignment: u8,
}

impl Default for AssStyle {
    fn default() -> Self {
        Self {
            name: "Default".into(),
            fontname: "Arial".into(),
            fontsize: 20.0,
            primary_colour: "&H00FFFFFF".into(),
            bold: false,
            italic: false,
            alignment: 2,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssDocument {
    pub kind: AssKind,
    pub styles: Vec<AssStyle>,
    pub cues: Vec<Cue>,
}

pub fn looks_like_ass(input: &str) -> bool {
    let lower = input.to_ascii_lowercase();
    lower.contains("[script info]")
        || lower.contains("[v4+ styles]")
        || lower.contains("[v4 styles]")
        || lower.contains("dialogue:")
        || lower.contains("comment:")
}

pub fn parse(input: &str) -> AssDocument {
    let text = input.trim_start_matches('\u{feff}').replace("\r\n", "\n").replace('\r', "\n");
    let kind = detect_kind(&text);
    let styles = parse_styles(&text, kind);
    let cues = parse_events(&text);
    AssDocument {
        kind,
        styles: if styles.is_empty() { vec![AssStyle::default()] } else { styles },
        cues,
    }
}

pub fn serialize(doc: &AssDocument) -> String {
    let styles = if doc.styles.is_empty() {
        vec![AssStyle::default()]
    } else {
        doc.styles.clone()
    };
    let mut out = String::new();
    out.push_str("[Script Info]\n");
    out.push_str("ScriptType: v4.00+\n");
    if doc.kind == AssKind::Ssa {
        // Keep SSA marker via Styles section; ScriptType still often v4.00 for SSA.
        out.clear();
        out.push_str("[Script Info]\n");
        out.push_str("ScriptType: v4.00\n");
    }
    out.push_str("PlayResX: 384\n");
    out.push_str("PlayResY: 288\n");
    out.push_str("ScaledBorderAndShadow: yes\n\n");

    match doc.kind {
        AssKind::Ass => {
            out.push_str("[V4+ Styles]\n");
            out.push_str(
                "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n",
            );
            for s in &styles {
                out.push_str(&format!(
                    "Style: {},{},{},{},&H000000FF,&H00000000,&H00000000,{},{},0,0,100,100,0,0,1,2,2,{},10,10,10,1\n",
                    escape_field(&s.name),
                    escape_field(&s.fontname),
                    format_num(s.fontsize),
                    normalize_colour(&s.primary_colour),
                    bool_flag(s.bold),
                    bool_flag(s.italic),
                    s.alignment.clamp(1, 9),
                ));
            }
        }
        AssKind::Ssa => {
            out.push_str("[V4 Styles]\n");
            out.push_str(
                "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, TertiaryColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, AlphaLevel, Encoding\n",
            );
            for s in &styles {
                out.push_str(&format!(
                    "Style: {},{},{},{},0,0,0,{},{},1,2,2,{},10,10,10,0,1\n",
                    escape_field(&s.name),
                    escape_field(&s.fontname),
                    format_num(s.fontsize),
                    ssa_colour(&s.primary_colour),
                    bool_flag(s.bold),
                    bool_flag(s.italic),
                    s.alignment.clamp(1, 9),
                ));
            }
        }
    }

    out.push_str("\n[Events]\n");
    out.push_str("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n");
    for cue in &doc.cues {
        let style = cue.style.as_deref().unwrap_or("Default");
        out.push_str(&format!(
            "Dialogue: 0,{},{},{},,0,0,0,,{}\n",
            format_ass_time(cue.start),
            format_ass_time(cue.end),
            escape_field(style),
            encode_dialogue_text(&cue.text),
        ));
    }
    out
}

fn detect_kind(text: &str) -> AssKind {
    let lower = text.to_ascii_lowercase();
    if lower.contains("[v4 styles]") && !lower.contains("[v4+ styles]") {
        AssKind::Ssa
    } else if lower.contains("scripttype:") && lower.contains("v4.00\n") && !lower.contains("v4.00+") {
        AssKind::Ssa
    } else {
        AssKind::Ass
    }
}

fn parse_styles(text: &str, kind: AssKind) -> Vec<AssStyle> {
    let mut styles = Vec::new();
    let mut in_styles = false;
    let mut format_cols: Vec<String> = Vec::new();

    for line in text.lines() {
        let trimmed = line.trim();
        let lower = trimmed.to_ascii_lowercase();
        if lower.starts_with('[') {
            in_styles = lower == "[v4+ styles]" || lower == "[v4 styles]";
            format_cols.clear();
            continue;
        }
        if !in_styles || trimmed.is_empty() || trimmed.starts_with(';') {
            continue;
        }
        if lower.starts_with("format:") {
            format_cols = split_fields(trimmed["format:".len()..].trim())
                .into_iter()
                .map(|s| s.to_ascii_lowercase())
                .collect();
            continue;
        }
        if lower.starts_with("style:") {
            let values = split_fields(trimmed["style:".len()..].trim());
            if let Some(style) = style_from_fields(&format_cols, &values, kind) {
                styles.push(style);
            }
        }
    }
    styles
}

fn style_from_fields(cols: &[String], values: &[String], kind: AssKind) -> Option<AssStyle> {
    let mut style = AssStyle::default();
    if cols.is_empty() {
        // No Format line: ASS order is well-known; SSA differs after SecondaryColour.
        style.name = values.first()?.clone();
        if let Some(f) = values.get(1) {
            style.fontname = f.clone();
        }
        if let Some(s) = values.get(2).and_then(|s| s.parse().ok()) {
            style.fontsize = s;
        }
        if let Some(c) = values.get(3) {
            style.primary_colour = c.clone();
        }
        match kind {
            AssKind::Ass => {
                style.bold = flag(values.get(7));
                style.italic = flag(values.get(8));
                if let Some(a) = values.get(18).and_then(|s| s.parse().ok()) {
                    style.alignment = a;
                }
            }
            AssKind::Ssa => {
                style.bold = flag(values.get(7));
                style.italic = flag(values.get(8));
                if let Some(a) = values.get(12).and_then(|s| s.parse().ok()) {
                    style.alignment = a;
                }
            }
        }
        return Some(style);
    }

    for (col, val) in cols.iter().zip(values.iter()) {
        match col.as_str() {
            "name" => style.name = val.clone(),
            "fontname" => style.fontname = val.clone(),
            "fontsize" => {
                if let Ok(n) = val.parse() {
                    style.fontsize = n;
                }
            }
            "primarycolour" => style.primary_colour = val.clone(),
            "bold" => style.bold = flag(Some(val)),
            "italic" => style.italic = flag(Some(val)),
            "alignment" => {
                if let Ok(n) = val.parse() {
                    style.alignment = n;
                }
            }
            _ => {}
        }
    }
    if style.name.is_empty() {
        None
    } else {
        Some(style)
    }
}

fn parse_events(text: &str) -> Vec<Cue> {
    let mut cues = Vec::new();
    let mut in_events = false;
    let mut format_cols: Vec<String> = Vec::new();

    for line in text.lines() {
        let trimmed = line.trim();
        let lower = trimmed.to_ascii_lowercase();
        if lower.starts_with('[') {
            in_events = lower == "[events]";
            format_cols.clear();
            continue;
        }
        if !in_events || trimmed.is_empty() || trimmed.starts_with(';') {
            continue;
        }
        if lower.starts_with("format:") {
            format_cols = split_fields(trimmed["format:".len()..].trim())
                .into_iter()
                .map(|s| s.to_ascii_lowercase())
                .collect();
            continue;
        }
        let is_dialogue = lower.starts_with("dialogue:");
        let is_comment = lower.starts_with("comment:");
        if !is_dialogue && !is_comment {
            continue;
        }
        if is_comment {
            continue; // skip comments for the cue list
        }
        let rest = trimmed["dialogue:".len()..].trim();
        if let Some(cue) = dialogue_from_line(rest, &format_cols) {
            cues.push(cue);
        }
    }

    cues.sort_by(|a, b| a.start.total_cmp(&b.start));
    cues
}

fn dialogue_from_line(rest: &str, cols: &[String]) -> Option<Cue> {
    // Text is the last field and may contain commas — split limited by column count.
    let expected = if cols.is_empty() { 10 } else { cols.len() };
    let parts = split_fields_n(rest, expected);
    if parts.len() < expected {
        return None;
    }

    let (start_i, end_i, style_i, text_i) = if cols.is_empty() {
        // Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
        (1usize, 2, 3, 9)
    } else {
        let idx = |name: &str| cols.iter().position(|c| c == name);
        (idx("start")?, idx("end")?, idx("style").unwrap_or(3), idx("text")?)
    };

    let start = parse_ass_time(parts.get(start_i)?)?;
    let end = parse_ass_time(parts.get(end_i)?)?;
    let style_name = parts.get(style_i).cloned().unwrap_or_else(|| "Default".into());
    let raw = parts.get(text_i).cloned().unwrap_or_default();
    Some(Cue {
        start,
        end,
        text: decode_dialogue_text(&raw),
        style: if style_name.is_empty() || style_name == "Default" {
            None
        } else {
            Some(style_name)
        },
    })
}

/// Split on commas, preserving empty fields.
fn split_fields(s: &str) -> Vec<String> {
    s.split(',').map(|p| p.trim().to_string()).collect()
}

/// Split into at most `n` fields; the last field keeps remaining commas.
fn split_fields_n(s: &str, n: usize) -> Vec<String> {
    if n == 0 {
        return vec![];
    }
    let mut out = Vec::with_capacity(n);
    let mut rest = s;
    for i in 0..n {
        if i + 1 == n {
            out.push(rest.trim().to_string());
            break;
        }
        match rest.find(',') {
            Some(pos) => {
                out.push(rest[..pos].trim().to_string());
                rest = &rest[pos + 1..];
            }
            None => {
                out.push(rest.trim().to_string());
                while out.len() < n {
                    out.push(String::new());
                }
                break;
            }
        }
    }
    out
}

fn flag(v: Option<&String>) -> bool {
    match v.map(|s| s.trim()) {
        Some("-1") | Some("1") | Some("true") | Some("yes") => true,
        _ => false,
    }
}

fn bool_flag(v: bool) -> i8 {
    if v { -1 } else { 0 }
}

fn format_num(n: f64) -> String {
    if (n - n.round()).abs() < f64::EPSILON {
        format!("{}", n.round() as i64)
    } else {
        format!("{n}")
    }
}

fn escape_field(s: &str) -> String {
    // Style/name fields shouldn't contain commas in practice; strip to keep Format columns aligned.
    s.replace(',', " ")
}

fn normalize_colour(c: &str) -> String {
    let t = c.trim();
    if t.is_empty() {
        return "&H00FFFFFF".into();
    }
    if t.starts_with("&H") || t.starts_with("&h") {
        return t.to_string();
    }
    // SSA decimal → ASS hex
    if let Ok(n) = t.parse::<u32>() {
        return format!("&H{n:08X}");
    }
    t.to_string()
}

fn ssa_colour(c: &str) -> String {
    let t = c.trim();
    if let Some(hex) = t.strip_prefix("&H").or_else(|| t.strip_prefix("&h")) {
        if let Ok(n) = u32::from_str_radix(hex, 16) {
            return n.to_string();
        }
    }
    if t.parse::<u32>().is_ok() {
        return t.to_string();
    }
    "16777215".into() // white
}

/// `H:MM:SS.CC` (centiseconds).
pub fn parse_ass_time(s: &str) -> Option<f64> {
    let s = s.trim();
    let (hms, cs) = s.split_once('.')?;
    let parts: Vec<&str> = hms.split(':').collect();
    let (h, m, sec) = match parts.as_slice() {
        [h, m, sec] => (h.parse::<f64>().ok()?, m.parse::<f64>().ok()?, sec.parse::<f64>().ok()?),
        [m, sec] => (0.0, m.parse::<f64>().ok()?, sec.parse::<f64>().ok()?),
        _ => return None,
    };
    let cs = cs.parse::<f64>().ok()?;
    // cs may be 1–2 digits; treat as centiseconds (pad mentally: "5" → 0.05? SE uses 2 digits)
    let frac = if cs >= 100.0 { cs / 1000.0 } else { cs / 100.0 };
    Some(h * 3600.0 + m * 60.0 + sec + frac)
}

pub fn format_ass_time(t: f64) -> String {
    let total_cs = (t.max(0.0) * 100.0).round() as u64;
    let (cs, total_s) = (total_cs % 100, total_cs / 100);
    let s = total_s % 60;
    let total_m = total_s / 60;
    let m = total_m % 60;
    let h = total_m / 60;
    format!("{h}:{m:02}:{s:02}.{cs:02}")
}

/// ASS dialogue → app text (`\N` → newline, basic `{\i1}`/`{\b1}` → HTML tags).
pub fn decode_dialogue_text(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut chars = raw.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '{' {
            let mut tag = String::new();
            for tc in chars.by_ref() {
                if tc == '}' {
                    break;
                }
                tag.push(tc);
            }
            apply_override_tags(&tag, &mut out);
            continue;
        }
        if c == '\\' {
            match chars.peek().copied() {
                Some('N') | Some('n') => {
                    chars.next();
                    out.push('\n');
                }
                Some('h') => {
                    chars.next();
                    out.push('\u{00A0}');
                }
                Some(other) => {
                    chars.next();
                    out.push(other);
                }
                None => out.push('\\'),
            }
            continue;
        }
        out.push(c);
    }
    out
}

fn apply_override_tags(tag: &str, out: &mut String) {
    // Handle simple i/b toggles; ignore drawing/karaoke/etc.
    let mut i = 0;
    let bytes = tag.as_bytes();
    while i < bytes.len() {
        if bytes[i] == b'\\' {
            i += 1;
            if i >= bytes.len() {
                break;
            }
            let rest = &tag[i..];
            if rest.starts_with('i') {
                let on = !rest.starts_with("i0");
                out.push_str(if on { "<i>" } else { "</i>" });
                i += if rest.starts_with("i0") || rest.starts_with("i1") { 2 } else { 1 };
            } else if rest.starts_with('b') {
                // `b` alone or `b1` / `b700` → bold on; `b0` → off
                let off = rest.starts_with("b0")
                    && rest.as_bytes().get(2).map(|c| !c.is_ascii_digit()).unwrap_or(true);
                out.push_str(if off { "</b>" } else { "<b>" });
                i += 1;
                while i < bytes.len() && bytes[i].is_ascii_digit() {
                    i += 1;
                }
            } else {
                // skip this override token
                i += 1;
                while i < bytes.len() && bytes[i] != b'\\' {
                    i += 1;
                }
            }
        } else {
            i += 1;
        }
    }
}

/// App text → ASS dialogue.
pub fn encode_dialogue_text(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut italic = false;
    let mut bold = false;
    let mut i = 0;
    let lower = text.to_ascii_lowercase();
    while i < text.len() {
        if lower[i..].starts_with("<i>") {
            if !italic {
                out.push_str("{\\i1}");
                italic = true;
            }
            i += 3;
            continue;
        }
        if lower[i..].starts_with("</i>") {
            if italic {
                out.push_str("{\\i0}");
                italic = false;
            }
            i += 4;
            continue;
        }
        if lower[i..].starts_with("<b>") || lower[i..].starts_with("<strong>") {
            let n = if lower[i..].starts_with("<strong>") { 8 } else { 3 };
            if !bold {
                out.push_str("{\\b1}");
                bold = true;
            }
            i += n;
            continue;
        }
        if lower[i..].starts_with("</b>") || lower[i..].starts_with("</strong>") {
            let n = if lower[i..].starts_with("</strong>") { 9 } else { 4 };
            if bold {
                out.push_str("{\\b0}");
                bold = false;
            }
            i += n;
            continue;
        }
        if lower[i..].starts_with("<em>") {
            if !italic {
                out.push_str("{\\i1}");
                italic = true;
            }
            i += 4;
            continue;
        }
        if lower[i..].starts_with("</em>") {
            if italic {
                out.push_str("{\\i0}");
                italic = false;
            }
            i += 5;
            continue;
        }
        let ch = text[i..].chars().next().unwrap();
        match ch {
            '\n' => out.push_str("\\N"),
            '{' | '}' => {
                // literal braces are rare; escape by dropping into text as-is (ASS treats {} as tags)
                out.push(ch);
            }
            _ => out.push(ch),
        }
        i += ch.len_utf8();
    }
    if italic {
        out.push_str("{\\i0}");
    }
    if bold {
        out.push_str("{\\b0}");
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const ASS_FIXTURE: &str = r#"[Script Info]
ScriptType: v4.00+
PlayResX: 384
PlayResY: 288

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1
Style: Sign,Comic Sans MS,24,&H0000FFFF,&H000000FF,&H00000000,&H00000000,-1,-1,0,0,100,100,0,0,1,2,2,8,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Hello{\i1} world{\i0}
Dialogue: 0,0:00:05.50,0:00:08.00,Sign,,0,0,0,,Line one\NLine two
"#;

    const SSA_FIXTURE: &str = r#"[Script Info]
ScriptType: v4.00

[V4 Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, TertiaryColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, AlphaLevel, Encoding
Style: Default,Tahoma,18,16777215,0,0,0,0,-1,1,2,2,2,10,10,10,0,1

[Events]
Format: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: Marked=0,0:01:00.00,0:01:02.50,Default,,0,0,0,,SSA line
"#;

    #[test]
    fn detects_ass() {
        assert!(looks_like_ass(ASS_FIXTURE));
        assert!(!looks_like_ass("1\n00:00:00,000 --> 00:00:01,000\nHi\n"));
    }

    #[test]
    fn parses_ass_styles_and_dialogue() {
        let doc = parse(ASS_FIXTURE);
        assert_eq!(doc.kind, AssKind::Ass);
        assert_eq!(doc.styles.len(), 2);
        assert_eq!(doc.styles[0].name, "Default");
        assert_eq!(doc.styles[1].name, "Sign");
        assert!(doc.styles[1].bold);
        assert!(doc.styles[1].italic);
        assert_eq!(doc.styles[1].alignment, 8);
        assert_eq!(doc.styles[1].primary_colour, "&H0000FFFF");
        assert_eq!(doc.cues.len(), 2);
        assert_eq!(doc.cues[0].start, 1.0);
        assert_eq!(doc.cues[0].end, 4.0);
        assert_eq!(doc.cues[0].text, "Hello<i> world</i>");
        assert!(doc.cues[0].style.is_none());
        assert_eq!(doc.cues[1].text, "Line one\nLine two");
        assert_eq!(doc.cues[1].style.as_deref(), Some("Sign"));
    }

    #[test]
    fn parses_ssa_quirks() {
        let doc = parse(SSA_FIXTURE);
        assert_eq!(doc.kind, AssKind::Ssa);
        assert_eq!(doc.styles[0].fontname, "Tahoma");
        assert_eq!(doc.styles[0].fontsize, 18.0);
        assert!(doc.styles[0].italic);
        assert!(!doc.styles[0].bold);
        assert_eq!(doc.cues[0].start, 60.0);
        assert_eq!(doc.cues[0].end, 62.5);
        assert_eq!(doc.cues[0].text, "SSA line");
    }

    #[test]
    fn ass_round_trips_dialogue_and_styles() {
        let doc = parse(ASS_FIXTURE);
        let out = serialize(&doc);
        let again = parse(&out);
        assert_eq!(again.kind, AssKind::Ass);
        assert_eq!(again.styles.len(), 2);
        assert_eq!(again.styles[1].name, "Sign");
        assert_eq!(again.styles[1].fontname, "Comic Sans MS");
        assert!(again.styles[1].bold && again.styles[1].italic);
        assert_eq!(again.styles[1].alignment, 8);
        assert_eq!(again.cues.len(), 2);
        assert_eq!(again.cues[0].text, "Hello<i> world</i>");
        assert_eq!(again.cues[1].text, "Line one\nLine two");
        assert_eq!(again.cues[1].style.as_deref(), Some("Sign"));
        assert!((again.cues[0].start - 1.0).abs() < 0.001);
        assert!((again.cues[1].end - 8.0).abs() < 0.001);
    }

    #[test]
    fn ssa_round_trips() {
        let doc = parse(SSA_FIXTURE);
        let again = parse(&serialize(&doc));
        assert_eq!(again.kind, AssKind::Ssa);
        assert_eq!(again.cues[0].text, "SSA line");
        assert_eq!(again.styles[0].fontname, "Tahoma");
        assert!(again.styles[0].italic);
    }

    #[test]
    fn times_centiseconds() {
        assert_eq!(parse_ass_time("0:00:01.00"), Some(1.0));
        assert_eq!(parse_ass_time("1:02:03.45"), Some(3723.45));
        assert_eq!(format_ass_time(1.0), "0:00:01.00");
        assert_eq!(format_ass_time(3723.45), "1:02:03.45");
    }

    #[test]
    fn text_encode_decode() {
        assert_eq!(decode_dialogue_text(r"a\Nb{\i1}c{\i0}"), "a\nb<i>c</i>");
        assert_eq!(encode_dialogue_text("a\nb<i>c</i>"), r"a\Nb{\i1}c{\i0}");
    }

    #[test]
    fn dialogue_with_commas_in_text() {
        let raw = r#"[Script Info]
ScriptType: v4.00+
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello, world, again
"#;
        let doc = parse(raw);
        assert_eq!(doc.cues[0].text, "Hello, world, again");
    }
}
