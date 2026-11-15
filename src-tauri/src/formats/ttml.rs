//! TTML / DFXP (`.ttml`, `.dfxp`) parse + serialize.
//!
//! **Public API (for orchestrator / sibling agents):**
//! - [`parse`] / [`serialize`] — same cue model as SRT/VTT (`crate::subtitles::Cue`,
//!   times as seconds `f64`).
//! - [`looks_like_ttml`] — heuristic for auto-detect before dispatch.
//! - [`EXTENSIONS`] — `["ttml", "dfxp"]`.
//!
//! **Error style:** invalid timed `<p>` elements are skipped (same as SRT/VTT/SBV —
//! no `Result`). Empty/missing begin+end (or begin+dur) → skip.
//!
//! **Time expressions (TTML1 §10.4):**
//! - Clock-time: `hh:mm:ss.fraction`, `hh:mm:ss:ff` (frames), optional subframe
//!   `hh:mm:ss:ff.sub`.
//! - Offset-time: `Nh` / `Nm` / `Ns` / `Nms` / `Nf` / `Nt` (metric glued to number).
//! - Frame metric uses `ttp:frameRate` on `<tt>` when present; else **30** (TTML
//!   default). Tick metric uses `ttp:tickRate` when present; else **1**.
//!
//! **Limitations:** styles/regions/layout ignored; nested `<span>` unwrapped;
//! `<br/>` → newline; no wall-clock / SMPTE discontinuous; no IMSC paint-on /
//! ruby; CDATA not specially handled beyond normal text nodes.

use crate::subtitles::Cue;

/// File extensions this module owns (lowercase, no dot).
pub const EXTENSIONS: &[&str] = &["ttml", "dfxp"];

/// Default TTML frame rate when `ttp:frameRate` is absent.
const DEFAULT_FRAME_RATE: f64 = 30.0;
const DEFAULT_TICK_RATE: f64 = 1.0;

/// True when the text looks like TTML/DFXP (root `tt` / `dfxp`, or timed `p`).
pub fn looks_like_ttml(input: &str) -> bool {
    let text = strip_bom(input);
    let lower = text.to_ascii_lowercase();
    if lower.contains("<tt") || lower.contains("<dfxp") {
        return true;
    }
    // Timed paragraph without a clear root (fragment).
    lower.contains("<p ") && (lower.contains("begin=") || lower.contains(" end="))
}

/// Parse TTML/DFXP into cues sorted by `start`. Skips elements without valid times.
pub fn parse(input: &str) -> Vec<Cue> {
    let text = strip_bom(input).replace("\r\n", "\n").replace('\r', "\n");
    let frame_rate = attr_f64(&text, "frameRate").unwrap_or(DEFAULT_FRAME_RATE);
    let tick_rate = attr_f64(&text, "tickRate").unwrap_or(DEFAULT_TICK_RATE);
    let mut cues = Vec::new();

    let mut rest = text.as_str();
    while let Some((attrs, body, next)) = next_p_element(rest) {
        rest = next;
        let Some(start) = attr_value(&attrs, "begin").and_then(|s| parse_time_expr(s, frame_rate, tick_rate))
        else {
            continue;
        };
        let end = match attr_value(&attrs, "end").and_then(|s| parse_time_expr(s, frame_rate, tick_rate)) {
            Some(e) => e,
            None => match attr_value(&attrs, "dur").and_then(|s| parse_time_expr(s, frame_rate, tick_rate)) {
                Some(d) => start + d,
                None => continue,
            },
        };
        let cue_text = xml_inner_text(body);
        if cue_text.is_empty() {
            continue;
        }
        cues.push(Cue {
            start,
            end,
            text: cue_text,
            style: None,
        });
    }

    cues.sort_by(|a, b| a.start.total_cmp(&b.start));
    cues
}

/// Serialize cues as minimal TTML 1 (`xmlns` TTML, clock-time with milliseconds).
/// Newlines become `<br/>`; XML specials in text are escaped.
pub fn serialize(cues: &[Cue]) -> String {
    let mut out = String::from(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
         <tt xmlns=\"http://www.w3.org/ns/ttml\" xml:lang=\"en\">\n\
         <body>\n\
         <div>\n",
    );
    for cue in cues {
        out.push_str("  <p begin=\"");
        out.push_str(&format_clock(cue.start));
        out.push_str("\" end=\"");
        out.push_str(&format_clock(cue.end));
        out.push_str("\">");
        out.push_str(&escape_text_with_br(&cue.text));
        out.push_str("</p>\n");
    }
    out.push_str("</div>\n</body>\n</tt>\n");
    out
}

fn strip_bom(s: &str) -> &str {
    s.trim_start_matches('\u{feff}')
}

/// Read a numeric attribute by local name (`frameRate`, `tickRate`), ignoring prefixes.
fn attr_f64(text: &str, local: &str) -> Option<f64> {
    // Scan early head for `frameRate="25"` / `ttp:frameRate='25'`.
    let head = text.get(..text.len().min(4096))?;
    let lower = head.to_ascii_lowercase();
    let needle = local.to_ascii_lowercase();
    let mut search = lower.as_str();
    while let Some(i) = search.find(&needle) {
        let after = &search[i + needle.len()..];
        // Require attribute form: optional whitespace then `=`.
        let after_trim = after.trim_start();
        if !after_trim.starts_with('=') {
            search = &search[i + 1..];
            continue;
        }
        // Map back to original casing slice for value extract.
        let abs = head.len() - search.len() + i;
        let from_attr = &head[abs..];
        if let Some(v) = attr_value(from_attr, local) {
            return v.parse().ok();
        }
        search = &search[i + 1..];
    }
    None
}

/// Find next `<p…>…</p>` (optional namespace prefix). Returns (attrs, inner, rest).
fn next_p_element(s: &str) -> Option<(&str, &str, &str)> {
    let mut i = 0;
    while i < s.len() {
        let Some(rel) = s[i..].find('<') else {
            return None;
        };
        let start = i + rel;
        let after_lt = &s[start + 1..];
        let after_lower = after_lt.to_ascii_lowercase();
        if after_lower.starts_with('/') {
            i = start + 1;
            continue;
        }
        let Some((local, name_len)) = open_tag_local(&after_lower) else {
            i = start + 1;
            continue;
        };
        if local != "p" {
            i = start + 1;
            continue;
        }
        let after_name = &after_lt[name_len..];
        let Some(gt) = after_name.find('>') else {
            return None;
        };
        let open_inside = &after_name[..gt];
        let self_closing = open_inside.trim_end().ends_with('/');
        let content_start = start + 1 + name_len + gt + 1;
        if self_closing {
            i = content_start;
            continue;
        }
        let attrs = open_inside.trim().trim_end_matches('/').trim();
        let (inner_len, end_off) = find_close_p(&s[content_start..])?;
        let body = &s[content_start..content_start + inner_len];
        let rest = &s[content_start + end_off..];
        return Some((attrs, body, rest));
    }
    None
}

/// Local name + byte length of `prefix:name` or `name` at start of lowercased after-`<`.
fn open_tag_local(after_lt_lower: &str) -> Option<(&str, usize)> {
    let end = after_lt_lower
        .find(|c: char| c.is_whitespace() || c == '>' || c == '/')
        .unwrap_or(after_lt_lower.len());
    if end == 0 {
        return None;
    }
    let name = &after_lt_lower[..end];
    let local = name.rsplit_once(':').map(|(_, l)| l).unwrap_or(name);
    Some((local, end))
}

/// Returns (inner_len, offset past closing `</p>`).
fn find_close_p(content: &str) -> Option<(usize, usize)> {
    let lower = content.to_ascii_lowercase();
    let mut depth = 1usize;
    let mut i = 0;
    while i < lower.len() {
        let Some(rel) = lower[i..].find('<') else {
            return None;
        };
        let at = i + rel;
        let after = &lower[at + 1..];
        if after.starts_with('/') {
            let Some((local, _)) = open_tag_local(&after[1..]) else {
                i = at + 1;
                continue;
            };
            let Some(gt) = content[at..].find('>') else {
                return None;
            };
            let end = at + gt + 1;
            if local == "p" {
                depth -= 1;
                if depth == 0 {
                    return Some((at, end));
                }
            }
            i = end;
            continue;
        }
        if after.starts_with('!') || after.starts_with('?') {
            i = at + 1;
            continue;
        }
        let Some((local, name_len)) = open_tag_local(after) else {
            i = at + 1;
            continue;
        };
        let after_name = &after[name_len..];
        let Some(gt) = after_name.find('>') else {
            return None;
        };
        let tag_end = at + 1 + name_len + gt + 1;
        let open_inside = &after_name[..gt];
        let self_closing = open_inside.trim_end().ends_with('/');
        if local == "p" && !self_closing {
            depth += 1;
        }
        i = tag_end;
    }
    None
}

fn attr_value<'a>(attrs: &'a str, local: &str) -> Option<&'a str> {
    let lower = attrs.to_ascii_lowercase();
    let needle = local.to_ascii_lowercase();
    let mut search_from = 0;
    while let Some(rel) = lower[search_from..].find(&needle) {
        let i = search_from + rel;
        // Ensure we matched a local name (start or after ':' / whitespace).
        if i > 0 {
            let prev = lower.as_bytes()[i - 1] as char;
            if prev.is_ascii_alphanumeric() || prev == '-' || prev == '_' {
                search_from = i + 1;
                continue;
            }
        }
        let after_name = &attrs[i + needle.len()..];
        let after_lower = &lower[i + needle.len()..];
        let trimmed = after_lower.trim_start();
        if !trimmed.starts_with('=') {
            search_from = i + 1;
            continue;
        }
        let eq_off = after_name.len() - after_name.trim_start().len();
        let after_eq = after_name[eq_off..].trim_start();
        // Skip `=`.
        let after_eq = after_eq.strip_prefix('=')?.trim_start();
        let (quote, rest) = match after_eq.as_bytes().first() {
            Some(b'"') => ('"', &after_eq[1..]),
            Some(b'\'') => ('\'', &after_eq[1..]),
            _ => return None,
        };
        let end = rest.find(quote)?;
        return Some(&rest[..end]);
    }
    None
}

/// Convert a TTML time expression to seconds.
fn parse_time_expr(s: &str, frame_rate: f64, tick_rate: f64) -> Option<f64> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }
    // Offset-time: number + metric (no colon).
    if !s.contains(':') {
        return parse_offset(s, frame_rate, tick_rate);
    }
    parse_clock(s, frame_rate)
}

fn parse_offset(s: &str, frame_rate: f64, tick_rate: f64) -> Option<f64> {
    let s = s.trim();
    // Longest metric first: `ms` before `m`/`s`.
    let (num, metric) = if let Some(n) = s.strip_suffix("ms") {
        (n, "ms")
    } else if let Some(n) = s.strip_suffix('h') {
        (n, "h")
    } else if let Some(n) = s.strip_suffix('m') {
        (n, "m")
    } else if let Some(n) = s.strip_suffix('s') {
        (n, "s")
    } else if let Some(n) = s.strip_suffix('f') {
        (n, "f")
    } else if let Some(n) = s.strip_suffix('t') {
        (n, "t")
    } else {
        return None;
    };
    let n: f64 = num.trim().parse().ok()?;
    Some(match metric {
        "h" => n * 3600.0,
        "m" => n * 60.0,
        "s" => n,
        "ms" => n / 1000.0,
        "f" => n / frame_rate.max(1e-9),
        "t" => n / tick_rate.max(1e-9),
        _ => return None,
    })
}

/// Clock-time: `hh:mm:ss.fff` | `hh:mm:ss:ff` | `hh:mm:ss:ff.sub` | `mm:ss.fff`.
fn parse_clock(s: &str, frame_rate: f64) -> Option<f64> {
    let parts: Vec<&str> = s.split(':').collect();
    match parts.as_slice() {
        // hh:mm:ss.fraction
        [h, m, sec] if sec.contains('.') => {
            let h: f64 = h.parse().ok()?;
            let m: f64 = m.parse().ok()?;
            let sec: f64 = sec.parse().ok()?;
            Some(h * 3600.0 + m * 60.0 + sec)
        }
        // hh:mm:ss (whole seconds)
        [h, m, sec] => {
            let h: f64 = h.parse().ok()?;
            let m: f64 = m.parse().ok()?;
            let sec: f64 = sec.parse().ok()?;
            Some(h * 3600.0 + m * 60.0 + sec)
        }
        // hh:mm:ss:ff or hh:mm:ss:ff.sub
        [h, m, sec, frames] => {
            let h: f64 = h.parse().ok()?;
            let m: f64 = m.parse().ok()?;
            let sec: f64 = sec.parse().ok()?;
            let frames: f64 = frames.parse().ok()?;
            Some(h * 3600.0 + m * 60.0 + sec + frames / frame_rate.max(1e-9))
        }
        // mm:ss.fraction (uncommon but seen)
        [m, sec] if sec.contains('.') => {
            let m: f64 = m.parse().ok()?;
            let sec: f64 = sec.parse().ok()?;
            Some(m * 60.0 + sec)
        }
        _ => None,
    }
}

fn format_clock(t: f64) -> String {
    let total_ms = (t.max(0.0) * 1000.0).round() as u64;
    let (ms, total_s) = (total_ms % 1000, total_ms / 1000);
    format!(
        "{:02}:{:02}:{:02}.{:03}",
        total_s / 3600,
        total_s % 3600 / 60,
        total_s % 60,
        ms
    )
}

fn xml_inner_text(body: &str) -> String {
    let mut out = String::new();
    let mut i = 0;
    let bytes = body.as_bytes();
    while i < body.len() {
        if bytes[i] == b'<' {
            let rest = &body[i..];
            let lower = rest.to_ascii_lowercase();
            if lower.starts_with("<br") {
                // <br>, <br/>, <br />
                if let Some(gt) = rest.find('>') {
                    out.push('\n');
                    i += gt + 1;
                    continue;
                }
            }
            // Skip any other tag.
            if let Some(gt) = rest.find('>') {
                i += gt + 1;
                continue;
            }
            break;
        }
        // Decode a few entities / accumulate until next `<`.
        if bytes[i] == b'&' {
            if let Some((ch, n)) = decode_entity(&body[i..]) {
                out.push(ch);
                i += n;
                continue;
            }
        }
        let next = body[i..].find('<').map(|n| i + n).unwrap_or(body.len());
        out.push_str(&decode_text_chunk(&body[i..next]));
        i = next;
    }
    // Collapse runs of spaces/tabs but preserve newlines from <br/>.
    normalize_ws(&out)
}

fn decode_text_chunk(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut i = 0;
    while i < s.len() {
        if s.as_bytes()[i] == b'&' {
            if let Some((ch, n)) = decode_entity(&s[i..]) {
                out.push(ch);
                i += n;
                continue;
            }
        }
        out.push(s[i..].chars().next().unwrap());
        i += s[i..].chars().next().unwrap().len_utf8();
    }
    out
}

fn decode_entity(s: &str) -> Option<(char, usize)> {
    if let Some(rest) = s.strip_prefix("&amp;") {
        let _ = rest;
        return Some(('&', 5));
    }
    if s.starts_with("&lt;") {
        return Some(('<', 4));
    }
    if s.starts_with("&gt;") {
        return Some(('>', 4));
    }
    if s.starts_with("&quot;") {
        return Some(('"', 6));
    }
    if s.starts_with("&apos;") {
        return Some(('\'', 6));
    }
    if let Some(rest) = s.strip_prefix("&#") {
        let (digits, _) = rest.split_once(';')?;
        let code = if let Some(hex) = digits.strip_prefix(['x', 'X']) {
            u32::from_str_radix(hex, 16).ok()?
        } else {
            digits.parse().ok()?
        };
        let ch = char::from_u32(code)?;
        return Some((ch, 2 + digits.len() + 1));
    }
    None
}

fn normalize_ws(s: &str) -> String {
    let mut out = String::new();
    for (li, line) in s.split('\n').enumerate() {
        if li > 0 {
            out.push('\n');
        }
        let collapsed: String = line.split_whitespace().collect::<Vec<_>>().join(" ");
        out.push_str(&collapsed);
    }
    out.trim().to_string()
}

fn escape_text_with_br(text: &str) -> String {
    text.split('\n')
        .map(escape_xml)
        .collect::<Vec<_>>()
        .join("<br/>")
}

fn escape_xml(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            _ => out.push(c),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const DIALOGUE: &str = include_str!("fixtures/dialogue.ttml");
    const DFXP: &str = include_str!("fixtures/dialogue.dfxp");
    const OFFSETS: &str = include_str!("fixtures/offsets.ttml");

    #[test]
    fn detects_ttml_not_srt() {
        assert_eq!(EXTENSIONS, &["ttml", "dfxp"]);
        assert!(looks_like_ttml(DIALOGUE));
        assert!(looks_like_ttml(DFXP));
        assert!(!looks_like_ttml(
            "1\n00:00:00,000 --> 00:00:01,000\nHi\n"
        ));
        assert!(!looks_like_ttml(
            "0:00:00.000,0:00:01.000\nHi\n"
        ));
    }

    #[test]
    fn parses_common_dialogue_clock_times() {
        let cues = parse(DIALOGUE);
        assert_eq!(cues.len(), 3);
        assert_eq!(cues[0].start, 0.0);
        assert_eq!(cues[0].end, 1.547);
        assert_eq!(cues[0].text, "The right side, you can see.");
        assert_eq!(cues[1].start, 1.547);
        assert_eq!(cues[1].end, 3.2);
        assert_eq!(cues[1].text, "What is\nwhat?");
        assert_eq!(cues[2].start, 65.5);
        assert_eq!(cues[2].end, 67.0);
        assert_eq!(cues[2].text, "One hour later.");
    }

    #[test]
    fn parses_dfxp_namespace_and_bom_crlf() {
        let raw = format!("\u{feff}{}", DFXP.replace('\n', "\r\n"));
        let cues = parse(&raw);
        assert_eq!(cues.len(), 2);
        assert!((cues[0].start - 0.32).abs() < 0.0001);
        assert!((cues[0].end - 1.76).abs() < 0.0001);
        assert_eq!(cues[0].text, "Café & déjà vu");
        assert_eq!(cues[1].text, "Line two.");
    }

    #[test]
    fn parses_offset_times_and_dur() {
        let cues = parse(OFFSETS);
        assert_eq!(cues.len(), 3);
        assert!((cues[0].start - 1.5).abs() < 1e-9);
        assert!((cues[0].end - 3.0).abs() < 1e-9);
        // 90f @ 25 fps = 3.6s, dur 50f = 2.0s → end 5.6
        assert!((cues[1].start - 3.6).abs() < 1e-9);
        assert!((cues[1].end - 5.6).abs() < 1e-9);
        assert_eq!(cues[1].text, "Frames");
        assert!((cues[2].start - 10.0).abs() < 1e-9);
        assert!((cues[2].end - 12.5).abs() < 1e-9);
    }

    #[test]
    fn parses_frame_clock_with_document_rate() {
        let xml = r#"<?xml version="1.0"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter"
    ttp:frameRate="25">
<body><div>
<p begin="00:00:01:12" end="00:00:02:00">Hi</p>
</div></body></tt>"#;
        let cues = parse(xml);
        assert_eq!(cues.len(), 1);
        // 1s + 12/25
        assert!((cues[0].start - (1.0 + 12.0 / 25.0)).abs() < 1e-9);
        assert!((cues[0].end - 2.0).abs() < 1e-9);
    }

    #[test]
    fn skips_broken_and_untimed() {
        let xml = r#"<tt xmlns="http://www.w3.org/ns/ttml"><body><div>
<p>No times</p>
<p begin="bad" end="00:00:01.000">Nope</p>
<p begin="00:00:01.000" end="00:00:02.000">Ok</p>
</div></body></tt>"#;
        assert_eq!(
            parse(xml),
            vec![Cue {
                start: 1.0,
                end: 2.0,
                text: "Ok".into(),
                style: None,
        }]
        );
    }

    #[test]
    fn round_trips_dialogue() {
        let cues = parse(DIALOGUE);
        let out = serialize(&cues);
        assert_eq!(parse(&out), cues);
        assert!(out.contains("begin=\"00:00:00.000\" end=\"00:00:01.547\""));
        assert!(out.contains("What is<br/>what?"));
        assert!(out.contains("xmlns=\"http://www.w3.org/ns/ttml\""));
    }

    #[test]
    fn writes_canonical_clock_and_escapes() {
        let out = serialize(&[Cue {
            start: 3661.5,
            end: 3662.0,
            text: "A & B <C>".into(),
            style: None,
        }]);
        assert!(out.contains("begin=\"01:01:01.500\" end=\"01:01:02.000\""));
        assert!(out.contains("A &amp; B &lt;C&gt;"));
    }

    #[test]
    fn time_expr_helpers() {
        assert_eq!(parse_time_expr("00:00:01.500", 30.0, 1.0), Some(1.5));
        assert_eq!(parse_time_expr("1.5s", 30.0, 1.0), Some(1.5));
        assert_eq!(parse_time_expr("1500ms", 30.0, 1.0), Some(1.5));
        assert_eq!(parse_time_expr("90f", 25.0, 1.0), Some(3.6));
        assert_eq!(parse_time_expr("00:00:01:15", 30.0, 1.0), Some(1.5));
        assert_eq!(format_clock(1.5), "00:00:01.500");
        assert_eq!(format_clock(3723.45), "01:02:03.450");
    }
}
