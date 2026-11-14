# Substudio UI Style Guide

Linear-style simplicity + shadcn/ui components + Subtitle Edit's editing density. Calm, precise, comfortable for long sessions. The layout deliberately mirrors Subtitle Edit so the first user's muscle memory carries over (reference: `docs/mockups/subtitle-editor-base.html`).

## Principles

1. Keep the video, subtitle list and waveform visible at all times.
2. Colour has a job: purple = selection or the primary action; red = needs attention; neutrals carry everything else.
3. Keep information dense. This is a professional editing tool, not a marketing dashboard.
4. No decoration for its own sake: no gradients, heavy shadows or colourful panels.
5. Keyboard first. Common actions must not need the mouse.
6. No AI in the UI yet. The manual workflow comes first.
7. Never signal with colour alone. Problem cells also get an icon and a hover message.

## Tokens

Themes live in `src/styles/themes/<id>.css` and are registered in `src/features/settings/themes.ts`. Components use Tailwind classes mapped to tokens (`bg-card`, `text-muted-foreground`, `bg-row-selected`); never hard-coded hex.

**shadcn semantic tokens:** `background foreground card popover primary secondary muted accent destructive border input ring` (+ `-foreground` pairs).

**Editor tokens** (Substudio-specific; every theme must define all of them):

| Token | Used for |
|---|---|
| `row-selected`, `row-hover` | Subtitle list rows |
| `cell-error-bg`, `cell-error-fg` | Problem cells (timing, reading speed) |
| `video-bg`, `preview-text`, `preview-box` | Video area and the subtitle drawn over it |
| `timeline-bg`, `timeline-fg`, `timeline-muted` | Waveform background, cue labels, ruler |
| `waveform-a`, `waveform-b`, `waveform-selected` | Audio outside cues / inside cues / inside the selected cue |
| `cue-region`, `cue-region-selected`, `cue-edge`, `cue-edge-selected`, `cue-error` | Cue boxes on the waveform |
| `playhead` | Playhead line |

The waveform is a canvas and reads these via `src/features/waveform/tokens.ts` (cached, re-read on theme change). Add any new canvas colour there too.

### Light (base) values

| Token | Hex |
|---|---|
| background | `#F8FAFC` |
| card / popover | `#FFFFFF` |
| foreground | `#0F172A` |
| muted-foreground | `#64748B` |
| border / input | `#E2E8F0` |
| primary | `#7C3AED` (hover via `/80`) |
| accent / row-selected | `#EDE9FE` |
| ring / cue-edge-selected | `#A78BFA` |
| destructive / cell-error-fg | `#B91C1C` |
| cell-error-bg | `#FEE2E2` |
| timeline-bg | `#252A34` |
| waveform-a / waveform-b | `#22C55E` / `#EAB308` |

## Typography

Inter Variable (bundled via `@fontsource-variable/inter`, so it works offline), system fallbacks. Always `tabular-nums` for timecodes and durations.

| Element | Size | Weight |
|---|---|---|
| Section headings | 14px | 600 |
| Table content (base) | 13px | 400–500 |
| Labels | 12px | 500 |
| Secondary details | 12px | 400 |
| Subtitle editing text | 15px | 500 |

Check new fonts with Yoruba tone marks (ẹ̀ ọ́ ṣ, stacked marks) before adopting them.

## Layout & components

- **Spacing:** a 4px grid; prefer 8 / 12 / 16 / 24.
- **Corners:** 8px for controls, 12px (`rounded-xl`) for panels.
- **Borders and shadows:** 1px borders, minimal shadows. Panels are bordered cards on the app background, with no cards nested inside cards.
- **Resizing:** panels are resizable; the gaps between them are the drag handles.
- **Row density:** a user setting (`data-density`): Compact 28px (default, close to Subtitle Edit) or Comfortable 36px. Use `ROW_HEIGHT` or `var(--row-h)`, never a fixed height.
- **Buttons:** shadcn Button. A filled purple button is reserved for the primary action in a region; toolbars use ghost or outline.
- **Icons:** Lucide, 16–18px, with a consistent stroke.
- **Timecodes:** a per-project setting. The default is frames (`hh:mm:ss:ff`) at 25 fps; the alternative is milliseconds (`hh:mm:ss,mmm`).
