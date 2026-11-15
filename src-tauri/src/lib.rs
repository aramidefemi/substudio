mod ffmpeg_bin;
mod files;
mod media;
mod menu;
mod project;
mod subtitles;
mod waveform;

use files::BackupInfo;
use media::MediaInfo;
use subtitles::{Cue, SubtitleFormat};
use tauri::{Emitter, Manager};

/// Reads a .srt/.vtt file, detecting the encoding when it isn't UTF-8 (FIL-04).
#[tauri::command]
async fn read_subtitles(path: String) -> Result<Vec<Cue>, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(files::parse_auto(&bytes).cues)
}

/// Like `read_subtitles`, but also says which encoding was used.
#[tauri::command]
async fn read_subtitles_detect(path: String) -> Result<files::DetectedSubtitles, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(files::parse_auto(&bytes))
}

#[tauri::command]
async fn read_subtitles_encoded(path: String, encoding: String) -> Result<Vec<Cue>, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    files::parse_with_encoding(&bytes, &encoding)
}

#[tauri::command]
async fn write_subtitles(path: String, cues: Vec<Cue>, format: SubtitleFormat) -> Result<(), String> {
    std::fs::write(&path, subtitles::serialize(&cues, format)).map_err(|e| e.to_string())
}

/// Raw UTF-8 text for script import (SCR-01). BOM is stripped.
#[tauri::command]
async fn read_text_file(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&bytes);
    Ok(text.strip_prefix('\u{FEFF}').unwrap_or(&text).to_string())
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

/// Waveform peaks for a media file as raw bytes (see `waveform::Peaks::to_bytes`),
/// cached in the app cache dir. Progress (0–1) streams over `on_progress`.
#[tauri::command]
async fn waveform_peaks(
    app: tauri::AppHandle,
    path: String,
    on_progress: tauri::ipc::Channel<f32>,
) -> Result<tauri::ipc::Response, String> {
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        waveform::load_or_compute(&path, &cache_dir, |p| {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
