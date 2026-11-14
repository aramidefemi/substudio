//! The native menu bar. Custom items emit their id to the frontend as a
//! `menu` event; `src/app/actions.ts` maps ids to actions.

use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Runtime};

pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let item = |id: &str, label: &str, accel: Option<&str>| {
        let builder = MenuItemBuilder::with_id(id, label);
        match accel {
            Some(a) => builder.accelerator(a).build(app),
            None => builder.build(app),
        }
    };

    let file = SubmenuBuilder::new(app, "File")
        .item(&item("file.new", "New", Some("CmdOrCtrl+N"))?)
        .item(&item("file.open", "Open Subtitles…", Some("CmdOrCtrl+O"))?)
        .item(&item("file.openVideo", "Open Video…", Some("CmdOrCtrl+Shift+O"))?)
        .separator()
        .item(&item("file.save", "Save", Some("CmdOrCtrl+S"))?)
        .item(&item("file.saveAs", "Save As…", Some("CmdOrCtrl+Shift+S"))?)
        .build()?;

    // Undo/redo are custom so they reach the subtitle history; the frontend
    // falls back to native text undo while a text field has focus.
    let edit = SubmenuBuilder::new(app, "Edit")
        .item(&item("edit.undo", "Undo", Some("CmdOrCtrl+Z"))?)
        .item(&item("edit.redo", "Redo", Some("CmdOrCtrl+Shift+Z"))?)
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .separator()
        .item(&item("edit.find", "Find…", Some("CmdOrCtrl+F"))?)
        .build()?;

    let theme = SubmenuBuilder::new(app, "Theme")
        .item(&item("view.theme.system", "Match System", None)?)
        .item(&item("view.theme.light", "Light", None)?)
        .item(&item("view.theme.dark", "Dark", None)?)
        .build()?;
    let density = SubmenuBuilder::new(app, "Row Density")
        .item(&item("view.density.compact", "Compact", None)?)
        .item(&item("view.density.comfortable", "Comfortable", None)?)
        .build()?;
    let view = SubmenuBuilder::new(app, "View")
        .item(&theme)
        .item(&density)
        .item(&item("view.timecode", "Toggle Frames / Milliseconds", None)?)
        .build()?;

    let window = SubmenuBuilder::new(app, "Window").minimize().maximize().close_window().build()?;

    let mut menu = MenuBuilder::new(app);
    #[cfg(target_os = "macos")]
    {
        let app_menu = SubmenuBuilder::new(app, "Substudio")
            .about(None)
            .separator()
            .services()
            .separator()
            .hide()
            .hide_others()
            .show_all()
            .separator()
            .quit()
            .build()?;
        menu = menu.item(&app_menu);
    }
    let menu = menu.items(&[&file, &edit, &view, &window]).build()?;
    app.set_menu(menu)?;
    Ok(())
}
