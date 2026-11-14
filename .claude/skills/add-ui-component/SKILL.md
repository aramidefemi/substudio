---
name: add-ui-component
description: Add a shadcn/ui component or build a new piece of Substudio UI (panels, dialogs, menus, controls) that follows the style guide. Use for any frontend UI work.
---

# Add UI

Read `docs/style-guide.md` first. Key rules: tokens only (no hex), dense rows (`ROW_HEIGHT` / `--row-h`), `tabular-nums` for times, no colour-only signals, keyboard reachable.

## Adding a shadcn component

The shadcn CLI may stop at interactive prompts, so run it with stdin closed:

```sh
pnpm dlx shadcn@latest add <component> -y </dev/null
```

- **Where they go:** components land in `src/components/ui/`. Keep those files close to upstream; restyle at the call site with `className` instead of editing them, unless a change should apply everywhere.
- **Stray dependencies:** if a component pulls in `next-themes` (e.g. sonner), rewire it to `useResolvedTheme()` from `@/features/settings/appearance` and `pnpm remove next-themes`.
- **Tooltips:** `TooltipProvider` is already mounted in `App.tsx`.

## Building feature UI

- **Location:** put it under `src/features/<area>/`, or `src/app/` for app chrome.
- **Reading state:** with narrow Zustand selectors (`useSubtitles((s) => s.selectedId)`). For objects, wrap the selector in `useShallow`.
- **Changing state:** call store functions (`updateCue`, `select`…) or actions from `@/app/actions`, never `setState` with document data. Document edits must go through `edit()` so they're undoable.
- **Anything per-frame** (playhead, timecode readout, meters): subscribe with `clock.onTick` in an effect and write to a ref. See `VideoPanel.tsx`.
- **Icon buttons:** need `aria-label` and a tooltip that mentions the shortcut, e.g. "Save (⌘S)".
- **New actions:** implement the behaviour (store function or `src/app/actions.ts`), then add one entry to `COMMANDS` in `src/app/commands/definitions.ts` (id, label, group, optional keys and scope). Put it in the menu bar by adding its id to `MENU` in `src/app/commands/menu.ts`. Buttons call `runCommand(id)` and use `commandTitle(id)` for their tooltip. Use scope `outsideText` for any key that also means something while typing. The registry tests catch duplicate keys and unknown menu ids.
- **Long lists:** use TanStack Virtual, and add `"use no memo"` as the first statement of the component (React Compiler incompatibility).

## Checks

Run `pnpm check`, then look at the result in the running app (`pnpm app`) in **both** Light and Dark, at Compact and Comfortable density.
