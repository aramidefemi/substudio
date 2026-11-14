# Substudio

A fast, keyboard-first desktop subtitle editor (working name). The first user is a professional Nollywood subtitler who works on Yoruba-language films with English subtitles and currently uses Subtitle Edit. The UI deliberately mirrors Subtitle Edit's layout, made more minimal. **No AI features in the UI yet**: the manual workflow comes first. AI (Yoruba→English drafts, translation memory) comes later on top.

## Stack

- **Shell:** Tauri 2 (Rust), using macOS WebKit. Mac is the first platform.
- **Frontend:** React 19 + Vite + TypeScript, with React Compiler (Babel preset in `vite.config.ts`).
- **State:** Zustand, plus Immer patches for undo/redo.
- **UI:** shadcn/ui (Radix, "vega" style) + Tailwind CSS v4, Lucide icons, Sonner toasts.
- **Libraries:** TanStack Virtual (subtitle list), react-resizable-panels, tinykeys (shortcuts).
- **Rust plugins:** dialog, store (settings), window-state.

## Commands

```sh
pnpm app          # run the desktop app (tauri dev), what you normally want
pnpm dev          # frontend only in a browser at :1420 (no file dialogs)
pnpm check        # typecheck + eslint + vitest + cargo test, run before calling work done
pnpm test         # vitest (src/**/*.test.ts)
pnpm test:rust    # cargo tests in src-tauri
pnpm tauri build  # release .app/.dmg
```

## Layout

```
src/
  app/            App shell: App.tsx (resizable layout), Toolbar, FindDialog,
                  actions.ts (every user action + native-menu id map), useAppEvents.ts (menu events, shortcuts, title)
  features/
    subtitles/    store.ts (document, selection, undo), timecode.ts, rules.ts, SubtitleList, CueEditor
    playback/     clock.ts (playback time, outside React), VideoPanel, TransportBar
    waveform/     Waveform.tsx (canvas), draw.ts, tokens.ts (theme colours for canvas), view.ts (scroll/zoom)
    settings/     store.ts (app prefs, persisted via Rust store plugin), themes.ts, appearance.ts
  components/ui/  shadcn components (generated; keep close to upstream)
  styles/themes/  one CSS file per theme
  lib/            tauri.ts (typed Rust command wrappers), dom.ts, utils.ts
src-tauri/src/
  lib.rs          commands + plugin setup
  menu.rs         native menu bar (ids → frontend `menu` event → actions.ts)
  subtitles.rs    SRT/VTT parse + serialize (with tests)
docs/             style-guide.md, backlog.md (roadmap with IDs), subtitle-edit-features.md (SE5 feature reference), mockups/
```

## Architecture rules

- **Keep hot paths out of React.** The playhead, scrubbing, waveform drawing and per-frame readouts subscribe to `clock.onTick` / `useStore.subscribe` and write to canvas or DOM refs. React state changes only on discrete events (select, edit, play/pause).
- **All document changes go through `edit()`** in `features/subtitles/store.ts` so they're undoable. Pass a merge `key` for continuous edits (typing) so they collapse into one undo step.
- **Cues stay sorted by `start`.** Times are seconds (`number`) everywhere; formatting happens only at display time via `timecode.ts`.
- **Heavy or file work belongs in Rust:** parsing, saving, audio decoding / waveform peaks (planned: `symphonia`), ffmpeg sidecar. Return binary data via Tauri channels or `Response`, not JSON arrays.
- **One operation, many triggers.** Don't add a separate control for each variant of an operation (Subtitle Edit has 15 ways to move a line). Add one command and reach it from shortcuts, menus, the waveform and the palette. The command registry is ARC-01 in `docs/backlog.md`.
- **Media layer.** Subtitle times always refer to the *source* file's timeline. Frame stepping and snapping use the source's real frame timestamps (variable frame rate), never `1/fps`. Proxies preserve source timestamps and never replace the original. Bundle an LGPL ffmpeg build only.
- **Every user action lives in `app/actions.ts`.** If it appears in the native menu, add the item in `menu.rs` with the same id. Shortcuts that the native menu owns (⌘S, ⌘Z…) are bound in tinykeys only when `!inTauri`.
- **Colours come only from tokens** (see `docs/style-guide.md`). Never hard-code hex in components or canvas code.
- **`SubtitleList` opts out of React Compiler** (`"use no memo"`) because of TanStack Virtual. Do the same for any component using `useVirtualizer`.

## Product decisions already made

- **Timecode:** per project; the default is frames at 25 fps (her workflow). Milliseconds is the alternative.
- **Row density:** Compact 28px (default) or Comfortable 36px.
- **Themes:** Light (the base, from the style guide) and Dark ship first. More themes are just token files.
- **Problem cells:** red background + icon + hover reason (never colour alone). Default limits: 1–7 s duration, 17 cps, 42 chars per line.
- **Privacy:** films are unreleased. Nothing leaves the machine without explicit consent.

## Skills

Project skills in `.claude/skills/`: `run-substudio` (launch and verify), `add-theme`, `add-tauri-command`, `add-ui-component`.
