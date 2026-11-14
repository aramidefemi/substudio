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
        .item(&item("file.saveSelected", "Save Selected Lines As…", None)?)
        .separator()
        .item(&item("file.openContainingFolder", "Open Containing Folder", None)?)
        .item(&item("file.openDataFolder", "Open Data Folder", None)?)
        .item(&item("file.copyPath", "Copy Subtitle Path", None)?)
        .item(&item("file.reload", "Reload", None)?)
        .separator()
        .item(&item("file.restoreBackup", "Restore Auto-backup…", None)?)
        .separator()
        .item(&item("file.compare", "Compare…", None)?)
        .item(&item("file.statistics", "Statistics…", None)?)
        .item(&item("file.mediaInfo", "Media Information…", None)?)
        .build()?;

    // Undo/redo and clipboard are custom so they reach the subtitle list when
    // a text field isn't focused; the frontend falls back to native text ops.
    let edit = SubmenuBuilder::new(app, "Edit")
        .item(&item("edit.undo", "Undo", Some("CmdOrCtrl+Z"))?)
        .item(&item("edit.redo", "Redo", Some("CmdOrCtrl+Shift+Z"))?)
        .item(&item("edit.history", "Show History…", None)?)
        .separator()
        .item(&item("edit.cut", "Cut", Some("CmdOrCtrl+X"))?)
        .item(&item("edit.copy", "Copy", Some("CmdOrCtrl+C"))?)
        .item(&item("edit.paste", "Paste", Some("CmdOrCtrl+V"))?)
        .item(&item("edit.selectAll", "Select All", Some("CmdOrCtrl+A"))?)
        .item(&item("edit.invertSelection", "Invert Selection", None)?)
        .separator()
        .item(&item("edit.italic", "Italic", Some("CmdOrCtrl+I"))?)
        .item(&item("edit.toggleLineBreak", "Toggle Line Break", Some("CmdOrCtrl+Shift+L"))?)
        .item(&item("edit.unbreak", "Unbreak", Some("CmdOrCtrl+Shift+R"))?)
        .item(&item("edit.autoBreak", "Auto-break", Some("CmdOrCtrl+R"))?)
        .item(&item("edit.balanceLines", "Balance Lines", None)?)
        .item(&item(
            "edit.breakAtFirstSpace",
            "Break at First Space",
            Some("CmdOrCtrl+Alt+Return"),
        )?)
        .item(&item(
            "edit.toggleDialogDashes",
            "Toggle Dialog Dashes",
            Some("CmdOrCtrl+Shift+D"),
        )?)
        .item(&item("edit.trimWhitespace", "Trim Whitespace", None)?)
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

    let move_start = SubmenuBuilder::new(app, "Move Start")
        .item(&item("timing.moveStart.frame.-", "−1 Frame", Some("Alt+Left"))?)
        .item(&item("timing.moveStart.frame.+", "+1 Frame", Some("Alt+Right"))?)
        .item(&item("timing.moveStart.ms.-", "−100 ms", None)?)
        .item(&item("timing.moveStart.ms.+", "+100 ms", None)?)
        .item(&item("timing.moveStart.custom.-", "−Custom ms", None)?)
        .item(&item("timing.moveStart.custom.+", "+Custom ms", None)?)
        .separator()
        .item(&item(
            "timing.moveStart.keepGap.frame.-",
            "−1 Frame (Keep Gap)",
            None,
        )?)
        .item(&item(
            "timing.moveStart.keepGap.frame.+",
            "+1 Frame (Keep Gap)",
            None,
        )?)
        .item(&item("timing.moveStart.push.frame.-", "−1 Frame (Push)", None)?)
        .item(&item("timing.moveStart.push.frame.+", "+1 Frame (Push)", None)?)
        .build()?;
    let move_end = SubmenuBuilder::new(app, "Move End")
        .item(&item("timing.moveEnd.frame.-", "−1 Frame", Some("Alt+Shift+Left"))?)
        .item(&item("timing.moveEnd.frame.+", "+1 Frame", Some("Alt+Shift+Right"))?)
        .item(&item("timing.moveEnd.ms.-", "−100 ms", None)?)
        .item(&item("timing.moveEnd.ms.+", "+100 ms", None)?)
        .item(&item("timing.moveEnd.custom.-", "−Custom ms", None)?)
        .item(&item("timing.moveEnd.custom.+", "+Custom ms", None)?)
        .separator()
        .item(&item("timing.moveEnd.keepGap.frame.-", "−1 Frame (Keep Gap)", None)?)
        .item(&item("timing.moveEnd.keepGap.frame.+", "+1 Frame (Keep Gap)", None)?)
        .item(&item("timing.moveEnd.push.frame.-", "−1 Frame (Push)", None)?)
        .item(&item("timing.moveEnd.push.frame.+", "+1 Frame (Push)", None)?)
        .build()?;
    let move_selected = SubmenuBuilder::new(app, "Move Selected")
        .item(&item(
            "timing.moveSelected.frame.-",
            "−1 Frame",
            Some("Alt+CmdOrCtrl+Left"),
        )?)
        .item(&item(
            "timing.moveSelected.frame.+",
            "+1 Frame",
            Some("Alt+CmdOrCtrl+Right"),
        )?)
        .item(&item("timing.moveSelected.ms.-", "−100 ms", None)?)
        .item(&item("timing.moveSelected.ms.+", "+100 ms", None)?)
        .item(&item("timing.moveSelected.custom.-", "−Custom ms", None)?)
        .item(&item("timing.moveSelected.custom.+", "+Custom ms", None)?)
        .separator()
        .item(&item(
            "timing.moveSelectedFollowing.frame.-",
            "−1 Frame + Following",
            None,
        )?)
        .item(&item(
            "timing.moveSelectedFollowing.frame.+",
            "+1 Frame + Following",
            None,
        )?)
        .item(&item(
            "timing.moveSelectedFollowing.ms.-",
            "−100 ms + Following",
            None,
        )?)
        .item(&item(
            "timing.moveSelectedFollowing.ms.+",
            "+100 ms + Following",
            None,
        )?)
        .build()?;
    let move_all = SubmenuBuilder::new(app, "Move All")
        .item(&item("timing.moveAll.frame.-", "−1 Frame", None)?)
        .item(&item("timing.moveAll.frame.+", "+1 Frame", None)?)
        .item(&item("timing.moveAll.ms.-", "−100 ms", None)?)
        .item(&item("timing.moveAll.ms.+", "+100 ms", None)?)
        .item(&item("timing.moveAll.custom.-", "−Custom ms", None)?)
        .item(&item("timing.moveAll.custom.+", "+Custom ms", None)?)
        .build()?;

    let timing = SubmenuBuilder::new(app, "Timing")
        .item(&move_start)
        .item(&move_end)
        .item(&move_selected)
        .item(&move_all)
        .separator()
        .item(&item("timing.setStart", "Set Start at Video", Some("F11"))?)
        .item(&item("timing.setEnd", "Set End at Video", Some("F12"))?)
        .item(&item("timing.setStartGoNext", "Set Start and Go to Next", None)?)
        .item(&item("timing.setEndGoNext", "Set End and Go to Next", Some("F10"))?)
        .item(&item(
            "timing.setStartKeepDuration",
            "Set Start (Keep Duration)",
            None,
        )?)
        .item(&item(
            "timing.setStartOffsetRest",
            "Set Start and Offset the Rest",
            Some("F9"),
        )?)
        .item(&item(
            "timing.setEndAddNew",
            "Set End, Add New and Go to New",
            Some("Shift+F10"),
        )?)
        .item(&item(
            "timing.setEndAndNextAfterGap",
            "Set End and Start of Next After Gap",
            None,
        )?)
        .item(&item(
            "timing.setStartAndPrevMinusGap",
            "Set Start and End of Previous Minus Gap",
            None,
        )?)
        .separator()
        .item(&item(
            "timing.extendToPrevious",
            "Extend to Previous Cue",
            Some("Alt+Shift+E"),
        )?)
        .item(&item(
            "timing.extendToNext",
            "Extend to Next Cue",
            Some("CmdOrCtrl+Shift+E"),
        )?)
        .item(&item(
            "timing.extendPreviousEnd",
            "Extend Previous End to Selected",
            None,
        )?)
        .item(&item(
            "timing.extendNextStart",
            "Extend Next Start to Selected",
            None,
        )?)
        .separator()
        .item(&item("timing.snapAllToFrames", "Snap All Times to Frames", None)?)
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
    let menu = menu.items(&[&file, &edit, &view, &timing, &window]).build()?;
    app.set_menu(menu)?;
    Ok(())
}
