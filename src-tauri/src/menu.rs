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

    let recent = SubmenuBuilder::new(app, "Open Recent")
        .item(&item("file.recent", "Recent Files…", None)?)
        .item(&item("file.recent.clear", "Clear Recent", None)?)
        .build()?;

    let file = SubmenuBuilder::new(app, "File")
        .item(&item("file.new", "New", Some("CmdOrCtrl+N"))?)
        .item(&item("file.newKeepingVideo", "New Keeping Video", None)?)
        .separator()
        .item(&item("file.open", "Open Subtitles…", Some("CmdOrCtrl+O"))?)
        .item(&item("file.openKeepingVideo", "Open Keeping Video…", None)?)
        .item(&item("file.importEncoding", "Import with Encoding…", None)?)
        .item(&recent)
        .item(&item("file.openVideo", "Open Video…", Some("CmdOrCtrl+Shift+O"))?)
        .separator()
        .item(&item("file.save", "Save", Some("CmdOrCtrl+S"))?)
        .item(&item("file.saveAs", "Save As…", Some("CmdOrCtrl+Shift+S"))?)
        .separator()
        .item(&item("file.openContainingFolder", "Open Containing Folder", None)?)
        .item(&item("file.openDataFolder", "Open Data Folder", None)?)
        .item(&item("file.reload", "Reload", None)?)
        .separator()
        .item(&item("file.restoreBackup", "Restore Auto-backup…", None)?)
        .build()?;

    // Undo/redo and clipboard are custom so they reach the subtitle list when
    // a text field isn't focused; the frontend falls back to native text ops.
    let edit = SubmenuBuilder::new(app, "Edit")
        .item(&item("edit.undo", "Undo", Some("CmdOrCtrl+Z"))?)
        .item(&item("edit.redo", "Redo", Some("CmdOrCtrl+Shift+Z"))?)
        .separator()
        .item(&item("edit.cut", "Cut", Some("CmdOrCtrl+X"))?)
        .item(&item("edit.copy", "Copy", Some("CmdOrCtrl+C"))?)
        .item(&item("edit.paste", "Paste", Some("CmdOrCtrl+V"))?)
        .item(&item("edit.selectAll", "Select All", Some("CmdOrCtrl+A"))?)
        .item(&item("edit.invertSelection", "Invert Selection", None)?)
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
    let columns = SubmenuBuilder::new(app, "Columns")
        .item(&item("view.column.cps", "CPS", None)?)
        .item(&item("view.column.gap", "Gap", None)?)
        .build()?;
    let view = SubmenuBuilder::new(app, "View")
        .item(&theme)
        .item(&density)
        .item(&columns)
        .item(&item("view.timecode", "Toggle Frames / Milliseconds", None)?)
        .item(&item("view.formatting", "Show Formatting in Grid", None)?)
        .item(&item(
            "view.privacy",
            "Screen Privacy",
            Some("CmdOrCtrl+Shift+P"),
        )?)
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
