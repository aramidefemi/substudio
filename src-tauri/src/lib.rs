mod batch;
mod burn;
mod ffmpeg_bin;
mod ffmpeg_job;
mod files;
mod formats;
mod media;
mod menu;
mod mux;
mod project;
mod proxy;
mod shot_changes;
mod spell_engine;
mod spellcheck;
mod subtitles;
mod waveform;

use files::BackupInfo;
use formats::ass::AssStyle;
use media::MediaInfo;
use proxy::PlaybackDecision;
use spellcheck::{CheckOptions, ListKind};
use subtitles::{Cue, SubtitleFormat};
use tauri::{Emitter, Manager};
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

/// Flags for the single running video export (burn-in DLV-01, mux DLV-02).
#[derive(Clone, Default)]
struct ExportJob {
    running: Arc<AtomicBool>,
    cancel: Arc<AtomicBool>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SpellCheckResult {
    engine: Option<&'static str>,
    language: String,
    issues: Vec<Vec<spellcheck::Issue>>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SpellSuggestResult {
    suggestions: Vec<String>,
}

/// Reads a subtitle file (.srt/.vtt/.ass/.ssa/.sbv/.ttml/.dfxp), detecting encoding when it isn't UTF-8 (FIL-04).
#[tauri::command]
async fn read_subtitles(path: String) -> Result<Vec<Cue>, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(files::parse_auto(&bytes).cues)
}

/// Like `read_subtitles`, but also returns encoding and ASS/SSA styles when present (FMT-01).
#[tauri::command]
async fn read_subtitles_detect(path: String) -> Result<files::DetectedSubtitles, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(files::parse_auto(&bytes))
}

#[tauri::command]
async fn read_subtitles_encoded(path: String, encoding: String) -> Result<files::DetectedSubtitles, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    files::parse_with_encoding(&bytes, &encoding)
}

#[tauri::command]
async fn write_subtitles(
    path: String,
    cues: Vec<Cue>,
    format: SubtitleFormat,
    styles: Option<Vec<AssStyle>>,
) -> Result<(), String> {
    let body = subtitles::serialize_with_styles(&cues, format, styles.as_deref());
    std::fs::write(&path, body).map_err(|e| e.to_string())
}

/// Raw UTF-8 text for script import (SCR-01). BOM is stripped.
#[tauri::command]
async fn read_text_file(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&bytes);
    Ok(text.strip_prefix('\u{FEFF}').unwrap_or(&text).to_string())
}

/// UTF-8 text write for custom exports (FMT-03).
#[tauri::command]
async fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

/// Subtitle files directly inside a folder, sorted (DLV-03).
#[tauri::command]
async fn list_subtitle_files(dir: String) -> Result<Vec<String>, String> {
    batch::list_subtitle_files(std::path::Path::new(&dir))
}

/// Converts many subtitle files into `out_dir` as `format`; failures are reported, not fatal (DLV-03).
#[tauri::command]
async fn batch_convert(
    paths: Vec<String>,
    format: SubtitleFormat,
    out_dir: String,
    offset_ms: Option<i64>,
    on_progress: tauri::ipc::Channel<batch::BatchProgress>,
) -> Result<batch::BatchOutcome, String> {
    tauri::async_runtime::spawn_blocking(move || {
        batch::convert_files(&paths, format, std::path::Path::new(&out_dir), offset_ms.unwrap_or(0), |p| {
            let _ = on_progress.send(p);
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Project sidecar next to the subtitle; `None` when missing or unreadable (FIL-03).
#[tauri::command]
async fn read_project(subtitle_path: String) -> Option<project::Project> {
    project::read(std::path::Path::new(&subtitle_path))
}

#[tauri::command]
async fn write_project(subtitle_path: String, project: project::Project) -> Result<(), String> {
    project::write(std::path::Path::new(&subtitle_path), &project)
}

#[tauri::command]
async fn file_mtime(path: String) -> Result<u64, String> {
    files::mtime_ms(&path)
}

#[tauri::command]
async fn reveal_path(path: String) -> Result<(), String> {
    files::reveal_path(&path)
}

#[tauri::command]
async fn open_path(path: String) -> Result<(), String> {
    files::open_path(&path)
}

#[tauri::command]
fn list_encodings() -> Vec<&'static str> {
    files::ENCODINGS.to_vec()
}

#[tauri::command]
async fn app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_auto_backup(
    app: tauri::AppHandle,
    label: String,
    cues: Vec<Cue>,
    format: SubtitleFormat,
    keep: Option<usize>,
) -> Result<String, String> {
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    files::write_auto_backup(&data, &label, &cues, format, keep.unwrap_or(30))
}

#[tauri::command]
async fn list_auto_backups(app: tauri::AppHandle) -> Result<Vec<BackupInfo>, String> {
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    files::list_backups(&data)
}

#[tauri::command]
async fn ensure_data_folder(app: tauri::AppHandle) -> Result<String, String> {
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    files::ensure_backup_dir(&data)?;
    std::fs::create_dir_all(&data).map_err(|e| e.to_string())?;
    Ok(data.to_string_lossy().into_owned())
}

#[tauri::command]
async fn probe_media(path: String) -> Result<MediaInfo, String> {
    tauri::async_runtime::spawn_blocking(move || media::probe(&path))
        .await
        .map_err(|e| e.to_string())?
}

/// Source video frame timestamps as SSFT bytes (MED-01). Cached by path+size+mtime.
#[tauri::command]
async fn media_frame_times(
    app: tauri::AppHandle,
    path: String,
) -> Result<tauri::ipc::Response, String> {
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        media::load_or_extract_frame_times(&path, &cache_dir)
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(bytes))
}

/// Shot-change timestamps as SSSC bytes (SYN-04). Cached by path+size+mtime+threshold.
#[tauri::command]
async fn detect_shot_changes(
    app: tauri::AppHandle,
    path: String,
    threshold: Option<f64>,
) -> Result<tauri::ipc::Response, String> {
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    let t = threshold.unwrap_or(shot_changes::DEFAULT_THRESHOLD);
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        shot_changes::load_or_detect(&path, &cache_dir, t)
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(bytes))
}

/// Playback path: source when WebKit-safe, else cached/encoded H.264 editing proxy (MED-02).
#[tauri::command]
async fn ensure_playback(
    app: tauri::AppHandle,
    path: String,
    on_progress: tauri::ipc::Channel<f32>,
) -> Result<PlaybackDecision, String> {
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        proxy::ensure_playback(&path, &cache_dir, |p| {
            let _ = on_progress.send(p);
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Run one video-writing ffmpeg job at a time (burn-in, mux); progress 0–1 over `on_progress`.
async fn run_export<T: Send + 'static>(
    job: &ExportJob,
    on_progress: tauri::ipc::Channel<f32>,
    work: impl FnOnce(&AtomicBool, &mut dyn FnMut(f32)) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    if job.running.swap(true, Ordering::SeqCst) {
        return Err("A video export is already running".into());
    }
    job.cancel.store(false, Ordering::SeqCst);
    let cancel = job.cancel.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        work(&cancel, &mut |p| {
            let _ = on_progress.send(p);
        })
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|r| r);
    job.running.store(false, Ordering::SeqCst);
    result
}

/// Burn the cues into a new `.mp4` (DLV-01).
#[tauri::command]
async fn burn_subtitles(
    job: tauri::State<'_, ExportJob>,
    source_path: String,
    dest_path: String,
    cues: Vec<Cue>,
    styles: Option<Vec<AssStyle>>,
    on_progress: tauri::ipc::Channel<f32>,
) -> Result<burn::BurnOutcome, String> {
    run_export(&job, on_progress, move |cancel, progress| {
        burn::burn(&source_path, &dest_path, &cues, styles.as_deref(), cancel, progress)
    })
    .await
}

/// Embed the cues as a soft subtitle track in a new `.mp4`/`.mov`/`.mkv` (DLV-02).
#[tauri::command]
async fn embed_subtitles(
    job: tauri::State<'_, ExportJob>,
    source_path: String,
    dest_path: String,
    cues: Vec<Cue>,
    styles: Option<Vec<AssStyle>>,
    on_progress: tauri::ipc::Channel<f32>,
) -> Result<mux::MuxOutcome, String> {
    run_export(&job, on_progress, move |cancel, progress| {
        mux::mux(&source_path, &dest_path, &cues, styles.as_deref(), cancel, progress)
    })
    .await
}

#[tauri::command]
fn cancel_export(job: tauri::State<'_, ExportJob>) {
    job.cancel.store(true, Ordering::SeqCst);
}

/// Waveform peaks for a media file as raw bytes (see `waveform::Peaks::to_bytes`),
/// cached in the app cache dir. `audio_track` is the 0-based audio stream ordinal
/// (PLY-05). Progress (0–1) streams over `on_progress`.
#[tauri::command]
async fn waveform_peaks(
    app: tauri::AppHandle,
    path: String,
    audio_track: Option<u32>,
    on_progress: tauri::ipc::Channel<f32>,
) -> Result<tauri::ipc::Response, String> {
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    let track = audio_track.unwrap_or(0);
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        waveform::load_or_compute(&path, &cache_dir, track, |p| {
            let _ = on_progress.send(p);
        })
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(bytes))
}

/// Rebuilds the menu bar from the frontend command registry.
#[tauri::command]
fn set_menu(app: tauri::AppHandle, spec: Vec<menu::MenuSpec>) -> Result<(), String> {
    menu::install(&app, &spec).map_err(|e| e.to_string())
}

fn spell_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(spellcheck::lists_dir(&data))
}

/// Batch-check cue texts (QLT-03). Uses names list + user dictionary + system engine.
#[tauri::command]
async fn spell_check_texts(
    app: tauri::AppHandle,
    texts: Vec<String>,
    language: String,
    check_tone_marked: Option<bool>,
) -> Result<SpellCheckResult, String> {
    let dir = spell_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let lists = spellcheck::read_lists(&dir);
        let opts = CheckOptions {
            language: language.clone(),
            check_tone_marked: check_tone_marked.unwrap_or(false),
        };
        let mut cache = HashMap::new();
        match spell_engine::system_engine() {
            Some(engine) => {
                let issues = spellcheck::check_texts(engine.as_ref(), &lists, &texts, &opts, &mut cache);
                Ok(SpellCheckResult {
                    engine: Some(engine.name()),
                    language,
                    issues,
                })
            }
            None => {
                // No engine: still honour her lists / tone-mark skips by treating
                // everything else as unknown (so the UI can show names-only mode).
                struct AcceptNone;
                impl spellcheck::SpellEngine for AcceptNone {
                    fn name(&self) -> &'static str {
                        "none"
                    }
                    fn languages(&self) -> Vec<String> {
                        vec![]
                    }
                    fn is_known(&self, _word: &str, _language: &str) -> bool {
                        false
                    }
                    fn suggest(&self, _word: &str, _language: &str) -> Vec<String> {
                        vec![]
                    }
                }
                let engine = AcceptNone;
                let issues = spellcheck::check_texts(&engine, &lists, &texts, &opts, &mut cache);
                Ok(SpellCheckResult {
                    engine: None,
                    language,
                    issues,
                })
            }
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn spell_suggest(word: String, language: String) -> Result<SpellSuggestResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let suggestions = spell_engine::system_engine()
            .map(|e| e.suggest(&word, &language))
            .unwrap_or_default();
        Ok(SpellSuggestResult { suggestions })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn spell_list_words(app: tauri::AppHandle, kind: String) -> Result<Vec<String>, String> {
    let dir = spell_dir(&app)?;
    let kind = parse_list_kind(&kind)?;
    Ok(spellcheck::read_list(&dir, kind).words())
}

#[tauri::command]
async fn spell_add_word(app: tauri::AppHandle, kind: String, word: String) -> Result<bool, String> {
    let dir = spell_dir(&app)?;
    let kind = parse_list_kind(&kind)?;
    let mut list = spellcheck::read_list(&dir, kind);
    let added = list.add(&word);
    if added {
        spellcheck::write_list(&dir, kind, &list)?;
    }
    Ok(added)
}

#[tauri::command]
async fn spell_remove_word(app: tauri::AppHandle, kind: String, word: String) -> Result<bool, String> {
    let dir = spell_dir(&app)?;
    let kind = parse_list_kind(&kind)?;
    let mut list = spellcheck::read_list(&dir, kind);
    let removed = list.remove(&word);
    if removed {
        spellcheck::write_list(&dir, kind, &list)?;
    }
    Ok(removed)
}

fn parse_list_kind(kind: &str) -> Result<ListKind, String> {
    match kind {
        "names" => Ok(ListKind::Names),
        "dictionary" => Ok(ListKind::Dictionary),
        _ => Err(format!("unknown spell list: {kind}")),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .manage(ExportJob::default())
        .setup(|app| {
            menu::install_base(app.handle())?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let _ = app.emit("menu", event.id().as_ref());
        })
        .invoke_handler(tauri::generate_handler![
            set_menu,
            waveform_peaks,
            read_subtitles,
            read_subtitles_detect,
            read_subtitles_encoded,
            write_subtitles,
            read_text_file,
            write_text_file,
            list_subtitle_files,
            batch_convert,
            read_project,
            write_project,
            file_mtime,
            reveal_path,
            open_path,
            list_encodings,
            app_data_dir,
            write_auto_backup,
            list_auto_backups,
            ensure_data_folder,
            probe_media,
            media_frame_times,
            detect_shot_changes,
            ensure_playback,
            burn_subtitles,
            embed_subtitles,
            cancel_export,
            spell_check_texts,
            spell_suggest,
            spell_list_words,
            spell_add_word,
            spell_remove_word,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
