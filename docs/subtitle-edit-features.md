# Subtitle Edit 5: full feature reference

Built from the documentation (subtitleedit.github.io/subtitleedit) and the source code (github.com/SubtitleEdit/subtitleedit, `main` branch, `src/ui/Features/**` plus the 642 commands in `Main/MainViewModel*.cs`), as of 2026-11-14.

The **Plan** column maps each feature to our backlog (`docs/backlog.md`):

- **✅** already in Substudio
- **M1** her daily driver
- **M2** quality tools
- **M3** formats & delivery
- **M4** AI
- **P** parked: not planned for now

---

## 1. Files & projects

| Feature | What it does | Plan |
|---|---|---|
| New / Open / Save / Save as | Standard file handling; Open auto-detects 380+ formats | ✅ (SRT/VTT) |
| New keeping video, Open keeping video | Start or open a subtitle without closing the video | ✅ |
| New window | Second editor window | P |
| Reopen / Recent files / Clear recent | Recent subtitle and video lists | ✅ |
| Open containing folder, Open data folder | Reveal in Finder | ✅ |
| Copy subtitle path to clipboard | Utility | M2 |
| Reload when changed outside the app | Detects external edits; reloads or asks | ✅ |
| Auto-save + auto-backup + Restore auto-backup | Periodic backups, kept 30 by default, restore UI | ✅ |
| Show history (undo history panel) | Browse and restore earlier states | M2 |
| Import with manually chosen encoding | For legacy-encoded files | ✅ |
| Import plain text (optional forced alignment to audio) | Turn a script into timed subtitles | M2 ❓ (her scripts) |
| Import time codes from another file | Apply another file's timings to the current text | M2 |
| Import formatting / styling from another file | Copy italics/bold/tags line by line | M3 |
| Import CSV / XLSX / ODS with column mapping | Spreadsheet import | M3 |
| Insert subtitle file after this line / at video position | Splice in another file | M2 |
| Save selected lines as… / Save forced lines as… | Partial export | M2 |
| Export plain text, dialogue list, custom text format (templates) | Text exports with placeholders | M3 |
| Format properties (per format) | ASS, EBU STL, PAC, D-Cinema, TTML settings | M3 |
| Compare two files | Side-by-side diff | M2 |
| Statistics (file and selected lines; dashboard with CPS histogram) | Totals, KPIs | M2 |
| Media information | Container, codec and track info for the video | M2 |
| Format limit warning | Warns when the target format can't hold features in use | M3 |

## 2. Subtitle list (grid)

| Feature | What it does | Plan |
|---|---|---|
| Columns # / Show / Hide / Duration / Text | Core grid | ✅ |
| Optional columns: CPS, WPM, Gap, Style, Actor, Layer, Pixel width, Forced, Shot in/out, Original | Show/hide and reorder columns | ✅ (CPS, Gap) · M2 (rest) |
| Syntax colouring of problems | Too short/long, too fast, too many lines, overlap, small gap | ✅ (basic) |
| Show formatting in grid, or hide tags | Italic/bold rendering in rows | ✅ |
| Single-line display, compact mode, alternating rows | Appearance options | ✅ (density) · M2 |
| Multi-select, select all, invert selection, Modify selection (by rule) | Selection tools | ✅ (multi-select) · M2 (modify) |
| Grid copy / cut / paste lines | Move whole cues around | ✅ |
| Column paste / copy / insert / shift cells up or down | Paste a column of text over existing timings | M2 |
| Fill selected lines with clipboard | Bulk text fill | M2 |
| Sort by: number, start, end, duration, CPS, WPM, gap, text, length, lines, style, actor | Sorting | M2 |
| Toggle forced (per line) | Mark forced subtitles | M3 |
| Screen privacy | Hides file names, then texts, for screen sharing | ✅ |
| Lock time codes | Prevents accidental timing edits | M2 |

## 3. Text box

| Feature | What it does | Plan |
|---|---|---|
| Text edit with chars/sec, line length, total chars | Core editor | ✅ |
| Italic / bold / underline / colour / font / box toggles (line or selection) | Formatting | M1 (italic) · M2 (rest) |
| Remove formatting (all, or italic/bold/colour/font/alignment) | Strip tags | M2 |
| Alignment {\an1–9} picker | Position tags | M3 |
| Toggle line break / Unbreak / Auto-break / balance | Line breaking | M1 |
| Break at first space from cursor (and go to next) | Fast re-breaking | M1 |
| Toggle dialog dashes | "- Line / - Line" dialogs | M1 |
| Toggle casing; selection to UPPER / lower / Sentence | Casing | M2 |
| Surround with 1–8 (custom wrappers, e.g. ♪ … ♪) | Snippets | M2 |
| Insert Unicode symbol | Symbol picker (♪ etc.) | M2 |
| Trim whitespace (selected lines) | Clean-up | M1 |
| Google it / look up in dictionary / custom search 1–5 | Look up selected text on the web | M2 |
| Single-letter shortcuts in text box, tag colouring, live spell check | Editor niceties | M2 |
| Record speech to text box | Dictate into the box | M4 |

## 4. Line operations

| Feature | What it does | Plan |
|---|---|---|
| Insert line before / after / at end | Add cues | M1 |
| Insert subtitle at video position (set end on key-up) | Hold a key while dialogue plays to create a timed cue | M1 ⭐ |
| Delete selected lines / Ripple delete (shift later cues back) | Remove cues | M1 |
| Duplicate selected lines | Copy cues | M1 |
| Split at text cursor / at video position / both (± then play) | Split one cue into two | M1 |
| Merge with previous / next (keep breaks, unbreak, as dialog) | Join cues | M1 |
| Merge selected lines (unbreak, CJK, dialog, bilingual) | Bulk join | M1 |
| Move first word from next line up / last word to next line | Rebalance text across cues | M1 |
| Move text before cursor to previous / from cursor to next (and play) | Fast re-splitting while listening | M1 |
| Fetch first word from next subtitle | Pull words back | M1 |
| Assisted split / Assisted move (ranked suggestions) | Smart split or move points | M2 |
| Evenly distribute selected lines | Spread cues across a time range | M2 |
| Recalculate duration (fit max CPS) | Auto durations | M2 |
| Remove blank lines | Clean-up | M1 |
| Renumber | Fix numbering | ✅ (implicit) |

## 5. Timing by keyboard

| Feature | What it does | Plan |
|---|---|---|
| Move start / end ±1 frame or ±X ms | Nudge timings | ✅ (in fields) · M1 (global keys) |
| …keeping the gap to the previous/next cue, or pushing neighbours | Move without creating overlaps | M1 |
| Move selected lines ±frame / ±ms / custom steps (with or without the following lines) | Shift blocks | M1 |
| Move all lines ±frame / ±ms / custom | Global shift | M1 |
| Set start / end at video position (go to next, keep duration, offset the rest) | Time while playing | M1 ⭐ |
| Set end, add new and go to new | Continuous timing flow | M1 ⭐ |
| Set end and start of next after the minimum gap | Chain cues tightly | M1 |
| Set start and set end of previous minus gap | Chain cues tightly | M1 |
| Extend selected to previous/next cue or shot change; extend previous end / next start to selected | Close gaps | M1 |
| Snap all times to frames | Frame-align everything | M1 |
| Copy ms relative to current line | Utility | P |

## 6. Waveform & spectrogram

| Feature | What it does | Plan |
|---|---|---|
| Waveform from the video's audio | Core visual | M1 (WAV-01) |
| Spectrogram, or both; classic / fancy styles; colour themes | Alternate views | M2 |
| Cue bars with text, CPS, number, duration | Labels on regions | ✅ (sample data) |
| Click to seek; Shift+click start; Ctrl+click end; Alt+click move | Mouse timing | M1 |
| Drag edges (Alt also moves the neighbour), drag middle | Retime | M1 |
| Drag empty area for a new selection → insert / paste / speech-to-text | Create cues | M1 (insert) · M4 (STT) |
| Horizontal / vertical zoom, scroll, centre, reset zoom & speed | Navigation | 🟡 · M1 |
| Context menu: insert, delete, split here, merge, copy, extract audio | Region actions | M1 |
| Seek silence back/forward; guess start, end or both | Snap to speech | M1 |
| Speech-only waveform (separates music/SFX with a model) | Clearer dialogue view | M4 |
| Shot changes: generate/import, list, toggle at position, next/previous, snap and "green zones" | Broadcast-style timing | M2 |
| Chapters toggle at position, next/previous chapter | Markers | P |
| Timeline tracks layout (thumbnails, layers) | Editor-style timeline | P |
| Waveform toolbar (configurable items) | On-waveform controls | M1 (basic) |
| Play selection once or looped; play next/previous (stop or loop) | Review playback | M1 ⭐ |
| Clone voice to engine | TTS | P |

## 7. Video playback

| Feature | What it does | Plan |
|---|---|---|
| Open video / from URL / recent; close | Load media | ✅ (local) · M1 (recent) |
| Play/pause, stop, full screen | Basics | ✅ |
| ±1 frame (with or without play), ±100 ms, ±500 ms, ±1 s, custom jumps 1–4 (and pause) | Precise stepping | M1 |
| Go to subtitle start/end; play from just before the text | Review a cue | M1 |
| Go to next/previous line from video position | Sync list to playhead | M1 |
| Playback faster/slower / set or toggle speed | Speed control | ✅ |
| Audio track picker / toggle | Multi-track files | M1 |
| Toggle subtitles on video; show original text on video | Preview options | M1 |
| Show time left; SMPTE timing (drop-frame) | Display modes | M2 |
| Video offset | Shift video vs subtitles | M2 |
| Brightness/contrast toggle | Dark scenes | M2 |
| Undock/redock video controls (second monitor) | Multi-monitor | M2 |
| Get frame rate from video file | Auto fps | M1 |
| Secondary subtitle overlay (open, settings, clear) | Compare against another track | M2 |
| Players: mpv, VLC, FFmpeg; hardware decoding; deinterlace | Engines | ✅ (WebKit) · M1 (ffmpeg proxy) |

## 8. Navigation & search

| Feature | What it does | Plan |
|---|---|---|
| Go to line number; first/last line | Jump | M1 |
| Next/previous line (keep or set video position, cursor at end) | Move through cues | ✅ (basic) · M1 |
| Go to next/previous error; go to next empty line | Fix-up passes | M1 ⭐ |
| Find, find next/previous, Replace (whole word, case, regex) | Search | 🟡 · M1 |
| Multiple replace (saved rule categories, import/export) | Bulk rules | M2 |
| Bookmarks: add/edit (with note), toggle, list, next/previous, clear | Mark lines to revisit | M1 |
| Command palette | Run anything by name | M1 |
| Focus shortcuts: grid ↔ text box ↔ waveform | Keyboard flow | M1 |

## 9. Quality & rules

| Feature | What it does | Plan |
|---|---|---|
| Rule profiles (Netflix, Amazon, Arte, broadcast, TikTok/Shorts…) | Limits per client | M1 |
| List errors (exportable) | All problems in one list | M1 |
| Custom error rules (toggle) | User-defined checks | M2 |
| Fix common errors (2-step wizard, ~30 fixes, profiles) | Bulk clean-up | M2 |
| Check and fix Netflix errors | Netflix spec | M2 |
| Beautify time codes (with before/after waveform) | Pro timing polish | M2 |
| Improve time codes (forced alignment) | Re-time a rough file to speech | M4 |
| Adjust durations; apply duration limits; apply min gap; bridge gaps | Timing tools | M2 |
| Remove text for hearing impaired | Strip [SFX], speaker labels | M2 |
| Remove/replace Unicode characters; RTL fixes | Character clean-up | M2 · P (RTL) |
| Find double words / double lines | Typos | M2 |
| AI review (proofreading) | Typos/grammar with reasons | M4 |

## 10. Tools (bulk transforms)

| Feature | What it does | Plan |
|---|---|---|
| Change casing; change formatting | Bulk text edits | M2 |
| Merge short lines / continuation lines / same text / same time codes | Bulk merges | M2 |
| Split/break long lines (rebalance) | Bulk breaking | M2 |
| Split subtitle file / Join subtitle files | File-level operations | M2 |
| Merge two subtitles (bilingual) | Two languages in one file | M3 |
| Convert actors ([NAME] → actor field); set/rename/remove actor, actor shortcuts 1–10 | Speaker metadata | M2 |
| Sort by… | See Grid | M2 |
| Batch convert (folders, presets, chained fixes, 380 formats) | Bulk processing | M3 |
| Command-line tool (seconv) | Headless conversion | P |
| Plugins | Extensions | P |

## 11. Synchronisation

| Feature | What it does | Plan |
|---|---|---|
| Adjust all times (all or selected) | Offset | M2 |
| Visual sync (two-scene linear fit) | Fix drift | M2 |
| Point sync / via other subtitle | Multi-point fit | M2 |
| Change frame rate / change speed | Conversions | M2 |
| Sync to audio / sync audio track | Auto-align with another track | M4 |
| Video offset, SMPTE timing | See Video | M2 |

## 12. Spell check & word lists

| Feature | What it does | Plan |
|---|---|---|
| Spell check window (change, change all, skip, add to names or dictionary, suggestions) | Proofing | M2 |
| Live spell check (underlines in grid and text box) | Inline proofing | M2 |
| Dictionaries download; pick language | Language packs | M2 |
| Names list, user dictionary, "use always" list, word lists editor | Custom vocab (Yoruba names!) | M2 ⭐ |
| Edit whole text | Bulk edit inside spell check | M2 |

## 13. Translation mode (original + translation)

| Feature | What it does | Plan |
|---|---|---|
| Open/close original; edit original mode; save original | Second text column per cue | M1 ❓ (her script workflow) |
| Copy text between original ⇄ translation; switch them; merge original into translation | Column ops | M2 |
| Lock original to translation timing | Keep both in sync | M2 |
| Make empty translation from current | Start a translation | M2 |
| Go to next subtitle and play (translate workflow) | Listen-then-type flow | M1 ⭐ |
| Auto-translate (30+ engines), translate selected lines, translate via copy-paste | Machine translation | M4 |

## 14. Formats

| Feature | Plan |
|---|---|
| SubRip, WebVTT | ✅ |
| ASS/SSA (styles, properties, attachments) | M3 |
| TTML/DFXP, IMSC, EBU-TT, SBV, YouTube srv3, Final Cut Pro XML, Premiere/DaVinci markers, CSV/JSON/Excel | M3 |
| EBU STL, PAC, Cavena 890, DVB teletext, Cheetah, CapMaker, D-Cinema | P |
| Image exports: Blu-ray SUP, BDN XML, VobSub, DVD sup, D-Cinema PNG/MXF, images with timecode, WebVTT thumbnails | P |
| Import from Matroska/MP4/TS tracks, CEA-608/708 captions | M3 |
| DVD (IFO/VOB) import, image subtitles for edit or OCR | P |

## 15. Video tools

| Feature | Plan |
|---|---|
| Burn-in subtitles (selected lines, logo, hardware encode) | M3 |
| Embed subtitles as a track; remux | M3 |
| Transparent subtitle video; blank video | M3 · P |
| Cut video (selected lines); re-encode for subtitling | P · M2 (proxy) |
| Chapters editor | P |
| Remove burned-in subtitles; video OCR | P |
| Background music generation | P |

## 16. Speech & AI

| Feature | Plan |
|---|---|
| Speech to text: whole file, selected lines, or a waveform selection; 15+ engines incl. Whisper and cloud | M4 ⭐ (Yoruba) |
| Detect speakers (diarisation) | M4 |
| AI assistant per line (fix, fit reading speed, formal/casual, ask) | M4 |
| AI review | M4 |
| Text-to-speech, voice manager, voice cloning, auto-cast, review speech | P |

## 17. OCR

| Feature | Plan |
|---|---|
| Image subtitle OCR (Tesseract, nOCR, binary, Apple Vision, LLM vision models), unknown-word handling, fix lists, batch OCR | P |

## 18. Styling for advanced formats

| Feature | Plan |
|---|---|
| ASSA styles, properties, attachments, font collector, resolution resampler | M3 |
| ASSA draw, advanced effects, progress bar, background, set position, colour picker, custom override tags | P |
| WebVTT styles and voices, browser preview | M3 |
| YouTube timed text styles (pens, windows, positions) | P |
| Styles 1–10 / colours 1–8 shortcuts; layer pick/filter | M3 |

## 19. Settings & customisation

| Feature | Plan |
|---|---|
| Settings with search; import/export; reset sections | M1 (basic) · M2 |
| Shortcuts editor (scopes, capture, duplicates, import from SE4, export) | M1 ⭐ |
| Custom shortcuts 1–8 (run command, insert text, find & replace) | M2 |
| 15 layouts; zoom layout in/out | M2 (1–2 layouts) |
| Themes (light/dark/custom), UI scale, fonts; cycle theme | ✅ (2 themes) |
| "Set up like SE4" preset | M1 (as "Set up like Subtitle Edit") |
| Toolbar items; waveform toolbar items; video control items | M2 |
| UI language | P |
| Proxy/network; updates (stable/beta) | P · M3 (updates) |
