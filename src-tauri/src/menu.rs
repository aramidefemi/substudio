//! The native menu bar. Its layout comes from the frontend command registry
//! (`src/app/commands/menu.ts`) via the `set_menu` command; custom items emit
//! their command id as a `menu` event. Only the macOS app menu and the Window
//! menu are defined here, because they use predefined system items.

use serde::Deserialize;
use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder, Submenu, SubmenuBuilder};
use tauri::{AppHandle, Runtime};

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum MenuSpec {
    Item {
        id: String,
        label: String,
        accelerator: Option<String>,
    },
    Separator,
    Submenu {
        label: String,
        items: Vec<MenuSpec>,
    },
}

/// Installed at startup so Quit and Window work before the frontend sends its menus.
pub fn install_base<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    app.set_menu(build(app, &[])?)?;
    Ok(())
}

/// Replaces the menu bar with the system menus plus the given top-level submenus.
pub fn install<R: Runtime>(app: &AppHandle<R>, spec: &[MenuSpec]) -> tauri::Result<()> {
    app.set_menu(build(app, spec)?)?;
    Ok(())
}

fn build<R: Runtime>(app: &AppHandle<R>, spec: &[MenuSpec]) -> tauri::Result<Menu<R>> {
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
    for node in spec {
        if let MenuSpec::Submenu { label, items } = node {
            menu = menu.item(&submenu(app, label, items)?);
        }
    }
    let window = SubmenuBuilder::new(app, "Window").minimize().maximize().close_window().build()?;
    menu.item(&window).build()
}

fn submenu<R: Runtime>(app: &AppHandle<R>, label: &str, items: &[MenuSpec]) -> tauri::Result<Submenu<R>> {
    let mut builder = SubmenuBuilder::new(app, label);
    for node in items {
        builder = match node {
            MenuSpec::Item { id, label, accelerator } => {
                let mut item = MenuItemBuilder::with_id(id.as_str(), label);
                if let Some(accel) = accelerator {
                    item = item.accelerator(accel);
                }
                builder.item(&item.build(app)?)
            }
            MenuSpec::Separator => builder.separator(),
            MenuSpec::Submenu { label, items } => builder.item(&submenu(app, label, items)?),
        };
    }
    builder.build()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_frontend_spec() {
        let json = r#"[{"type":"submenu","label":"File","items":[
            {"type":"item","id":"file.save","label":"Save","accelerator":"CmdOrCtrl+S"},
            {"type":"separator"},
            {"type":"submenu","label":"Recent","items":[{"type":"item","id":"file.recent","label":"Recent…","accelerator":null}]}
        ]}]"#;
        let spec: Vec<MenuSpec> = serde_json::from_str(json).unwrap();
        let MenuSpec::Submenu { label, items } = &spec[0] else { panic!("expected submenu") };
        assert_eq!(label, "File");
        assert_eq!(items.len(), 3);
        assert!(matches!(&items[0], MenuSpec::Item { accelerator: Some(a), .. } if a == "CmdOrCtrl+S"));
        assert!(matches!(items[1], MenuSpec::Separator));
    }
}
