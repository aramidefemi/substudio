---
name: run-substudio
description: Launch the Substudio desktop app (Tauri dev) or the browser-only frontend, and verify a change works. Use when asked to run, start, test or check the app, or before reporting work as done.
---

# Run Substudio

## Before saying a change works

Run the full check from the repo root:

```sh
pnpm check   # tsc --noEmit, eslint, vitest, cargo test
```

Fix failures instead of reporting them as done. If a test is wrong rather than the code, say so explicitly.

## Launch the desktop app

```sh
pnpm app     # = pnpm tauri dev
```

- Run it in the background. It starts Vite on **:1420**, then compiles Rust and opens a native window titled "Substudio".
- **Timing:** the first Rust compile takes ~1–2 min; later ones take seconds. Ready looks like `Running \`target/debug/substudio\`` in the output.
- **Hot reload:** frontend edits hot-reload. Rust edits (`src-tauri/src/**`) trigger a recompile and app restart automatically.
- **"Port 1420 is already in use":** an old dev server is still running. Find it with `lsof -ti :1420`, confirm it is a previous Substudio/Vite process, then stop it.
- **Window state:** saved by the window-state plugin. Delete `~/Library/Application Support/app.substudio.desktop/` to reset settings and window state.

## Browser-only frontend

```sh
pnpm dev     # http://localhost:1420
```

Tauri APIs are unavailable: file dialogs show a toast, settings aren't persisted, and the native menu is absent (its shortcuts fall back to tinykeys). This is good enough for pure UI work, and it's what Claude-in-Chrome can open for screenshots.

## Release build

```sh
pnpm tauri build   # outputs src-tauri/target/release/bundle/{macos,dmg}
```

Signing and notarisation aren't set up yet (needs an Apple Developer account).
