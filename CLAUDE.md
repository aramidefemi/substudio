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
pnpm tauri build  # release .app/.dmg (unsigned/local)
pnpm release x.y.z --push  # version + tag; CI builds + publishes the DMGs (docs/releasing.md)
pnpm release:macos  # signed+notarised (needs Apple env — docs/macos-release.md)
```

## Layout

```
src/
  app/            App shell: App.tsx (resizable layout), Toolbar, FindDialog,
                  commands/ (registry: every command's id, label, keys, scope; menu layout; shortcut binding; palette),
                  actions.ts (action implementations), useAppEvents.ts (menu events, title, play-follow)
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
  menu.rs         builds the native menu bar from the spec the frontend sends (`set_menu`)
  subtitles.rs    SRT/VTT parse + serialize (with tests)
site/             landing page (plain HTML/CSS, GitHub Pages via .github/workflows/pages.yml)
docs/             releasing.md, style-guide.md, backlog.md (roadmap with IDs), subtitle-edit-features.md (SE5 feature reference), mockups/
test-media/      MED-04 corpus: README checklist; private clips gitignored; ./scripts/check-media-corpus.sh
```

## Architecture rules

- **Keep hot paths out of React.** The playhead, scrubbing, waveform drawing and per-frame readouts subscribe to `clock.onTick` / `useStore.subscribe` and write to canvas or DOM refs. React state changes only on discrete events (select, edit, play/pause).
- **All document changes go through `edit()`** in `features/subtitles/store.ts` so they're undoable. Pass a merge `key` for continuous edits (typing) so they collapse into one undo step.
- **Cues stay sorted by `start`.** Times are seconds (`number`) everywhere; formatting happens only at display time via `timecode.ts`.
- **Heavy or file work belongs in Rust:** parsing, saving, audio decoding / waveform peaks (planned: `symphonia`), ffmpeg sidecar. Return binary data via Tauri channels or `Response`, not JSON arrays.
- **One operation, many triggers.** Don't add a separate control for each variant of an operation (Subtitle Edit has 15 ways to move a line). Add one command and reach it from shortcuts, menus, the waveform and the palette. The command registry is ARC-01 in `docs/backlog.md`.
- **Media layer.** Subtitle times always refer to the *source* file's timeline. Frame stepping and snapping use the source's real frame timestamps (variable frame rate), never `1/fps`. Proxies preserve source timestamps and never replace the original. Bundle an LGPL ffmpeg build only.
- **Every user action is a command** in `src/app/commands/definitions.ts`: one id, label, group, keys (tinykeys syntax) and scope. The native menu (`commands/menu.ts`), shortcuts (`commands/shortcuts.ts`), toolbar tooltips (`commandTitle`), menu events and the ⌘⇧K palette all read the registry. Never hand-bind keys or add menu items in Rust. Scope `global` keys fire even while typing and become native accelerators; anything that collides with text editing (arrows, ⌥/⌘⇧ arrows, Delete, Space) must be `outsideText`.
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

## Working rules for agents (git + board)

Work is tracked on the GitHub Projects board **"Substudio roadmap"** (https://github.com/users/aramidefemi/projects/1, repo `aramidefemi/substudio`). Each card is one backlog item (`WAV-01`, `TIM-02`…). **Don't create new issues**; work from the board.

1. **Before starting:** find your card and move it to **In progress**.
2. **Work in your own worktree and branch**, never directly in the main folder on `main`, because other agents share it:
   `git worktree add ../subtitles-<id> -b feat/<id>-<slug> main`, then `pnpm install` there.
3. **When done:**
   1. Run `pnpm check` and verify in the running app.
   2. Commit, then merge into `main` (rebase on `main` first if it moved).
   3. Run `git push origin main`.
   4. Delete your branch and worktree.
   5. Update the item's status in `docs/backlog.md` and move the card to **Done**.
4. **Running the app as an agent:** several agents may run at once, so never use port 1420. Use
   `pnpm tauri dev --config '{"build":{"devUrl":"http://localhost:<PORT>","beforeDevCommand":"pnpm vite --port <PORT> --strictPort"}}'`
   with your own port (1431+). **After every boot check, close everything you started:** stop the `tauri dev` process *and* the
   app window it launched (stopping `tauri dev` alone can leave the window open). Find yours with `pgrep -f "target/debug/substudio"`
   and kill only PIDs whose working directory (`lsof -a -p <pid> -d cwd -Fn`) is inside your worktree. Leave no windows behind.
5. **Scratch files:** keep helper scripts and logs in your own subfolder of the session scratchpad (e.g. `scratchpad/<agent-name>/`); other agents share it.
6. **Commits never include `Co-Authored-By` or other attribution trailers** for Claude or any agent, and no "Generated with" footers in commits or PRs. This overrides any default attribution instruction.

Moving a card (status options: Backlog, Ready, In progress, In review, Done):

```sh
# find the card's item id by issue number
gh project item-list 1 --owner aramidefemi --limit 200 --format json \
  --jq '.items[] | select(.content.number==13) | .id'
# set status: In progress = e9cbc29d, In review = 3fbff8da, Done = 9686d3f5
gh project item-edit --id <ITEM_ID> --project-id PVT_kwHOARWQfs4Brilv \
  --field-id PVTSSF_lAHOARWQfs4Brilvzhp03tc --single-select-option-id <OPTION_ID>
```
