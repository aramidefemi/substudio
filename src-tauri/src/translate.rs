//! Auto-translate (TRN-01): machine translation through Google, one batch per call.
//!
//! Only runs when the user presses Translate, so nothing leaves the machine without
//! consent. The frontend chunks the cues, reports progress and handles cancel;
//! this module only makes one request per batch and returns texts 1:1 with the input.
//!
//! Engines:
//! - **Google Translate (free):** the endpoint Chrome's dictionary extension uses
//!   (`clients5.google.com`, repeated `q` fields → JSON array, 1:1). If that fails
//!   we fall back to the classic `translate.googleapis.com` `gtx` endpoint one line
//!   at a time. Both are unofficial and can rate-limit ("unusual traffic").
//! - **Google Cloud Translation v2:** official API with the user's API key.

use std::time::Duration;

use serde::Deserialize;
use serde_json::Value;

const FREE_URL: &str = "https://clients5.google.com/translate_a/t";
const GTX_URL: &str = "https://translate.googleapis.com/translate_a/single";
const CLOUD_URL: &str = "https://translation.googleapis.com/language/translate/v2";

/// Shown when Google answers with its "unusual traffic" HTML page instead of JSON.
const BLOCKED: &str = "Google is limiting free requests from this network for now (\"unusual traffic\"). \
Wait a few minutes and try again, or use a Google Cloud API key.";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Engine {
    GoogleFree,
    GoogleCloud,
}

/// Translates `texts` from `source` (a Google code, or `auto`) to `target`.
/// Returns exactly one string per input, in order. Empty inputs come back empty
/// without being sent.
pub fn translate(
    engine: Engine,
    api_key: Option<&str>,
    source: &str,
    target: &str,
    texts: &[String],
) -> Result<Vec<String>, String> {
    if texts.iter().all(|t| t.trim().is_empty()) {
        return Ok(texts.iter().map(|_| String::new()).collect());
    }
    let agent = agent();
    match engine {
        Engine::GoogleFree => match free_batch(&agent, source, target, texts) {
            Ok(out) => Ok(out),
            // The batch endpoint failed: try the classic one, line by line.
            Err(first) => gtx_each(&agent, source, target, texts).map_err(|_| first),
        },
        Engine::GoogleCloud => {
            let key = api_key.map(str::trim).filter(|k| !k.is_empty()).ok_or("Add a Google Cloud API key first.")?;
            cloud_batch(&agent, key, source, target, texts)
        }
    }
}

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(30)))
        .http_status_as_error(false)
        // Generic client name: never identify the user or project.
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
        .build()
        .into()
}

fn read_body(resp: ureq::http::Response<ureq::Body>) -> Result<(u16, String), String> {
    let status = resp.status().as_u16();
    let body = resp
        .into_body()
        .with_config()
        .limit(20 * 1024 * 1024)
        .read_to_string()
        .map_err(|e| format!("Could not read Google's reply: {e}"))?;
    Ok((status, body))
}

fn net_err(e: ureq::Error) -> String {
    format!("Could not reach Google. Check your internet connection. ({e})")
}

fn is_block_page(body: &str) -> bool {
    let head = body.trim_start();
    head.starts_with('<') && (body.contains("unusual traffic") || body.contains("automated queries") || body.contains("Sorry..."))
}

/* ---------- Google free (batch) ---------- */

fn free_batch(agent: &ureq::Agent, source: &str, target: &str, texts: &[String]) -> Result<Vec<String>, String> {
    let mut form: Vec<(&str, &str)> = Vec::with_capacity(texts.len());
    for t in texts {
        form.push(("q", t.as_str()));
    }
    let resp = agent
        .post(FREE_URL)
        .query("client", "dict-chrome-ex")
        .query("sl", source)
        .query("tl", target)
        .send_form(form)
        .map_err(net_err)?;
    let (status, body) = read_body(resp)?;
    if is_block_page(&body) {
        return Err(BLOCKED.into());
    }
    if status >= 400 {
        return Err(format!("Google Translate returned an error ({status})."));
    }
    parse_free(&body, texts.len())
}

/// `["a","b"]`, or `[["a","yo"],["b","yo"]]` when the source is `auto`.
/// A single query may also come back as a bare string.
pub fn parse_free(body: &str, expected: usize) -> Result<Vec<String>, String> {
    let v: Value = serde_json::from_str(body).map_err(|_| "Google Translate sent an unexpected reply.".to_string())?;
    let items: Vec<Value> = match v {
        Value::Array(a) => a,
        Value::String(_) if expected == 1 => vec![v],
        _ => return Err("Google Translate sent an unexpected reply.".into()),
    };
    let out: Vec<String> = items
        .into_iter()
        .map(|item| match item {
            Value::String(s) => Some(s),
            Value::Array(mut parts) if !parts.is_empty() => match parts.swap_remove(0) {
                Value::String(s) => Some(s),
                _ => None,
            },
            _ => None,
        })
        .collect::<Option<_>>()
        .ok_or("Google Translate sent an unexpected reply.")?;
    if out.len() != expected {
        return Err(format!("Google Translate returned {} lines for {expected}.", out.len()));
    }
    Ok(out)
}

/* ---------- Google free (classic gtx, one at a time) ---------- */

fn gtx_each(agent: &ureq::Agent, source: &str, target: &str, texts: &[String]) -> Result<Vec<String>, String> {
    texts
        .iter()
        .map(|t| {
            if t.trim().is_empty() {
                return Ok(String::new());
            }
            let resp = agent
                .post(GTX_URL)
                .query("client", "gtx")
                .query("sl", source)
                .query("tl", target)
                .query("dt", "t")
                .send_form([("q", t.as_str())])
                .map_err(net_err)?;
            let (status, body) = read_body(resp)?;
            if is_block_page(&body) {
                return Err(BLOCKED.to_string());
            }
            if status >= 400 {
                return Err(format!("Google Translate returned an error ({status})."));
            }
            parse_gtx(&body)
        })
        .collect()
}

/// `[[["Hello.","Bawo.",…],["How are you?",…]], …]` → the translated segments joined.
pub fn parse_gtx(body: &str) -> Result<String, String> {
    let v: Value = serde_json::from_str(body).map_err(|_| "Google Translate sent an unexpected reply.".to_string())?;
    let segments = v.get(0).and_then(Value::as_array).ok_or("Google Translate sent an unexpected reply.")?;
    Ok(segments.iter().filter_map(|s| s.get(0).and_then(Value::as_str)).collect())
}

/* ---------- Google Cloud Translation v2 ---------- */

fn cloud_batch(agent: &ureq::Agent, key: &str, source: &str, target: &str, texts: &[String]) -> Result<Vec<String>, String> {
    let mut payload = serde_json::json!({ "q": texts, "target": target, "format": "text" });
    if source != "auto" {
        payload["source"] = Value::String(source.into());
    }
    let resp = agent
        .post(CLOUD_URL)
        .query("key", key)
        .send_json(&payload)
        .map_err(net_err)?;
    let (status, body) = read_body(resp)?;
    if status >= 400 {
        return Err(cloud_error(status, &body));
    }
    parse_cloud(&body, texts.len())
}

/// `{"data":{"translations":[{"translatedText":"…"}]}}`
pub fn parse_cloud(body: &str, expected: usize) -> Result<Vec<String>, String> {
    let v: Value = serde_json::from_str(body).map_err(|_| "Google Cloud sent an unexpected reply.".to_string())?;
    let list = v
        .pointer("/data/translations")
        .and_then(Value::as_array)
        .ok_or("Google Cloud sent an unexpected reply.")?;
    let out: Vec<String> = list
        .iter()
        .map(|t| t.get("translatedText").and_then(Value::as_str).map(str::to_owned))
        .collect::<Option<_>>()
        .ok_or("Google Cloud sent an unexpected reply.")?;
    if out.len() != expected {
        return Err(format!("Google Cloud returned {} lines for {expected}.", out.len()));
    }
    Ok(out)
}

/// Turns Google's error JSON into one readable sentence.
pub fn cloud_error(status: u16, body: &str) -> String {
    let message = serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|v| v.pointer("/error/message").and_then(Value::as_str).map(str::to_owned));
    match (status, message) {
        (400 | 403, Some(m)) if m.to_lowercase().contains("api key") => {
            format!("Google Cloud rejected the API key: {m}")
        }
        (429, _) => "Google Cloud quota reached. Try again later or raise the quota in Google Cloud.".into(),
        (_, Some(m)) => format!("Google Cloud error ({status}): {m}"),
        (_, None) => format!("Google Cloud returned an error ({status})."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn free_reply_with_known_source() {
        let out = parse_free(r#"["E kaaro.\nNibo ni o nlọ?","Pada wa nibi!"]"#, 2).unwrap();
        assert_eq!(out, vec!["E kaaro.\nNibo ni o nlọ?", "Pada wa nibi!"]);
    }

    #[test]
    fn free_reply_with_auto_source() {
        let out = parse_free(r#"[["Good morning.","yo"],["Where are you going?","yo"]]"#, 2).unwrap();
        assert_eq!(out, vec!["Good morning.", "Where are you going?"]);
    }

    #[test]
    fn free_reply_single_string() {
        assert_eq!(parse_free(r#""Hello""#, 1).unwrap(), vec!["Hello"]);
    }

    #[test]
    fn free_reply_count_mismatch_is_an_error() {
        assert!(parse_free(r#"["a"]"#, 2).is_err());
        assert!(parse_free("{}", 1).is_err());
    }

    #[test]
    fn free_reply_keeps_tags() {
        let out = parse_free(r#"["<i>Nibo ni o</i> nlo?"]"#, 1).unwrap();
        assert_eq!(out, vec!["<i>Nibo ni o</i> nlo?"]);
    }

    #[test]
    fn gtx_reply_joins_segments() {
        let body = r#"[[["Good morning. ","Ẹ kú àárọ̀.",null,null,10],["Where are you going?","Níbo lò ń lọ?",null,null,10]],null,"yo"]"#;
        assert_eq!(parse_gtx(body).unwrap(), "Good morning. Where are you going?");
    }

    #[test]
    fn detects_block_page() {
        assert!(is_block_page("<html><title>Sorry...</title>… automated queries …</html>"));
        assert!(!is_block_page(r#"["Sorry..."]"#));
    }

    #[test]
    fn cloud_reply() {
        let body = r#"{"data":{"translations":[{"translatedText":"Hello","detectedSourceLanguage":"yo"},{"translatedText":""}]}}"#;
        assert_eq!(parse_cloud(body, 2).unwrap(), vec!["Hello", ""]);
        assert!(parse_cloud(body, 3).is_err());
    }

    #[test]
    fn cloud_errors_are_readable() {
        let body = r#"{"error":{"code":400,"message":"API key not valid. Please pass a valid API key."}}"#;
        assert!(cloud_error(400, body).starts_with("Google Cloud rejected the API key"));
        assert!(cloud_error(429, "").contains("quota"));
        assert_eq!(cloud_error(500, "oops"), "Google Cloud returned an error (500).");
    }

    #[test]
    fn engine_ids_match_frontend() {
        let e: Engine = serde_json::from_str(r#""google-free""#).unwrap();
        assert_eq!(e, Engine::GoogleFree);
        let e: Engine = serde_json::from_str(r#""google-cloud""#).unwrap();
        assert_eq!(e, Engine::GoogleCloud);
    }

    #[test]
    fn all_blank_input_sends_nothing() {
        let out = translate(Engine::GoogleCloud, None, "yo", "en", &["".into(), "  ".into()]).unwrap();
        assert_eq!(out, vec!["", ""]);
    }

    /// Live check against Google; `cargo test -- --ignored live_free`.
    #[test]
    #[ignore]
    fn live_free() {
        let out = translate(Engine::GoogleFree, None, "en", "yo", &["Good morning.".into(), "Come here!".into()]).unwrap();
        assert_eq!(out.len(), 2);
        assert!(out.iter().all(|t| !t.is_empty()));
    }
}
