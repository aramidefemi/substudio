---
name: add-theme
description: Add or change a Substudio colour theme (e.g. high contrast, classic Subtitle Edit, a custom accent). Use for any request about themes, colours, dark mode or palette tokens.
---

# Add a theme

A theme is one CSS file plus one registry entry. No component changes.

1. **Copy a theme file.** Copy `src/styles/themes/light.css` (or `dark.css` for a dark theme) to `src/styles/themes/<id>.css`. Change the selector to `[data-theme="<id>"]` only (the `:root` selector belongs to the base light theme).
2. **Define every token** that light.css defines, both the shadcn ones and the editor ones (`row-*`, `cell-error-*`, `video-*`, `preview-*`, `timeline-*`, `waveform-*`, `cue-*`, `playhead`). A missing token silently falls back to the light value. Compare the two files to confirm:
   ```sh
   diff <(grep -o -- '--[a-z-]*:' src/styles/themes/light.css | sort) <(grep -o -- '--[a-z-]*:' src/styles/themes/<id>.css | sort)
   ```
3. **Import it** in `src/index.css` next to the other theme imports.
4. **Register it** in `THEMES` in `src/features/settings/themes.ts` with `{ id, label, scheme: "light" | "dark" }`. `scheme` drives `dark:` utilities, native form controls and the macOS window appearance.
5. **Optionally** add it to the native View › Theme menu in `src-tauri/src/menu.rs` (`view.theme.<id>`) and map that id in `ACTIONS` in `src/app/actions.ts`.

## Checks

- **Contrast:** text 4.5:1 against its background, including `muted-foreground` on `card` and `row-selected`, and `cell-error-fg` on `cell-error-bg`.
- **Red vs green:** `cue-error` and `cell-error-*` must stay distinguishable from `waveform-a` (green) for colour-blind users. Differ in lightness, not just hue.
- **Waveform:** the canvas reads tokens through `src/features/waveform/tokens.ts`. If you add a new canvas colour, add its name to `NAMES` there and to every theme.
- **Before reporting done:** run `pnpm check`, then switch to the theme in the running app (toolbar gear › Theme) and look at the list, the problem cells and the waveform.
