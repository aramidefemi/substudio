---
name: add-tauri-command
description: Add Rust-side functionality to Substudio, such as a Tauri command, plugin, file/audio/video processing, or a native menu item, and call it from the frontend. Use whenever work belongs in src-tauri.
---

# Add a Tauri command

1. **Write the logic in a module** under `src-tauri/src/` (e.g. `waveform.rs`), with `#[cfg(test)]` unit tests. Keep it free of Tauri types so it's testable (see `subtitles.rs`).
2. **Expose it** in `src-tauri/src/lib.rs`:
   ```rust
   #[tauri::command]
   async fn compute_peaks(path: String) -> Result<Vec<f32>, String> { ... }
   ```
   - **Use `async fn`** for anything touching disk or taking more than ~1 ms, so the UI thread never blocks. Owned args (`String`, not `&str`) are required for async commands.
   - **Return errors** as `Result<_, String>` (map with `.map_err(|e| e.to_string())`).
   - **Register it** in `tauri::generate_handler![...]`.
3. **Add a typed wrapper** in `src/lib/tauri.ts` under `commands`. Argument names are camelCase on the JS side and map to snake_case Rust params automatically.
4. **Permissions:** our own commands need no capability entry, but Tauri **plugin** APIs and `core:window:*` calls do. Add those to `src-tauri/capabilities/default.json`.

## Large or streaming data (waveforms, progress)

- **Large data:** don't return big `Vec<f32>` as JSON. Return `tauri::ipc::Response::new(bytes)` and read it as an `ArrayBuffer` on the JS side, or stream with `tauri::ipc::Channel<T>` for progress updates.
- **Caching:** cache expensive results (e.g. waveform peaks) on disk next to the project, keyed by file path + size + mtime.
- **CPU-heavy work:** run it inside `tauri::async_runtime::spawn_blocking`.

## Native menu items

Add the item in `src-tauri/src/menu.rs` with an id like `file.something`. It's emitted to the frontend as a `menu` event. Map the same id in `ACTIONS` in `src/app/actions.ts`. If it has an accelerator, don't also bind that key in tinykeys for Tauri (see `useAppEvents.ts`).

## New plugins

Add both halves:

```sh
cargo add tauri-plugin-<name> --manifest-path src-tauri/Cargo.toml
pnpm add @tauri-apps/plugin-<name>
```

Then `.plugin(tauri_plugin_<name>::init())` in `lib.rs`, and its permissions in `capabilities/default.json`.

## Checks

Run `pnpm test:rust`, then `pnpm check`. Restart `pnpm app` to exercise the command end to end; Rust changes rebuild automatically.
