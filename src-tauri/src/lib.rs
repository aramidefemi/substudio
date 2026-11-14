mod menu;
mod subtitles;

use subtitles::{Cue, SubtitleFormat};
use tauri::Emitter;

/// Reads a .srt/.vtt file. Non-UTF-8 bytes are replaced rather than failing,
/// so legacy-encoded files still open.
#[tauri::command]
async fn read_subtitles(path: String) -> Result<Vec<Cue>, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(subtitles::parse(&String::from_utf8_lossy(&bytes)))
}

#[tauri::command]
async fn write_subtitles(path: String, cues: Vec<Cue>, format: SubtitleFormat) -> Result<(), String> {
    std::fs::write(&path, subtitles::serialize(&cues, format)).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .setup(|app| {
            menu::install(app.handle())?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let _ = app.emit("menu", event.id().as_ref());
        })
        .invoke_handler(tauri::generate_handler![read_subtitles, write_subtitles])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
