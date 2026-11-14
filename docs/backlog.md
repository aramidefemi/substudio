# Substudio backlog

Features from Subtitle Edit 5 (source: subtitleedit.github.io/subtitleedit), ordered by what our first user needs to drop Subtitle Edit for her daily work. Each item has an ID so it can become a GitHub issue one-to-one later.

**Status:** ✅ done · 🟡 partly done · ⬜ not started · ❓ ask her first

**Sizes:** S (under ½ day), M (1–2 days), L (3+ days). These are rough.

## North star

> She voluntarily chooses Substudio over Subtitle Edit for an entire movie, knowing both.

We don't measure progress by counting Subtitle Edit features. Fewer, consistent actions, each reachable several ways (key, right-click menu, waveform, palette), beat 15 visible variants of one operation.

## M1 definition of done: core editing checklist

None of these involve AI. All 12 must be true before we hand her a full film.

- [ ] **Import and export SRT/VTT**: reliable round-trip with no accidental changes
- [ ] **Video playback**: smooth seeking, pause, speed control and frame stepping on *her* files
- [ ] **Audio waveform**: generated from the actual media, not sample data
- [ ] **Subtitle list**: create, edit, delete, select and reorder entries
- [ ] **Timing operations**: drag, nudge, split, merge and shift subtitles
- [ ] **Keyboard workflow**: advance, replay, set timings and edit without the mouse
- [x] **Text editing**: line breaks, italics, punctuation and dialogue dashes
- [x] **Undo and recovery**: reliable undo/redo, auto-save and crash recovery (auto-backup done; undo was already in)
- [ ] **Quality checks**: overlaps, reading speed, duration and line length
- [ ] **Project persistence**: reopen a film and continue exactly where she stopped
- [ ] **Script workflow**: import and work through prepared dialogue when she has it
- [ ] **Media compatibility**: handle her actual film files and audio tracks (incl. variable frame rate)

## Acceptance benchmark

She repeats the same tasks on a film she has already subtitled, in both apps.

| Test | Success condition |
|---|---|
| Load a film | Correct playback and waveform |
| Subtitle 5 minutes | No missing core editing action |
| Correct 20 subtitles | Competitive completion time vs Subtitle Edit |
| Fix timing mistakes | Accurate output, no unintended overlaps |
| Close and reopen | No lost edits or broken media links |
| Export and reimport | Text, timestamps and supported formatting preserved |

## Open question that decides two milestones

❓ **What is in her Google Doc?** A Yoruba script, an English script, or her own notes?

- **It's a script:** SCR-01 (script import + line-by-line timing) is M1, and AI-03 (per-line suggestions) can be the first AI milestone *without* speech-to-text.
- **It's her notes, or there's no script:** AI suggestions need Yoruba text, so speech-to-text (AI-02) has to come first.

---

## M0: Boilerplate (done)

| ID | Feature | Status |
|---|---|---|
| SUB-001 | Open/save SubRip and WebVTT (Rust parser, BOM/CRLF safe) | ✅ |
| SUB-002 | Virtualised subtitle list (# / Start / End / Duration / Text) | ✅ |
| SUB-003 | Cue editor: Start/End/Duration fields, text, chars/sec, line length | ✅ |
| SUB-004 | Undo/redo with typing merged per cue | ✅ |
| SUB-005 | Problem cells: too short/long, overlap, reading speed, line length (with icon + reason) | ✅ |
| SUB-006 | Frames (25 fps) / milliseconds timecode modes | ✅ |
| SUB-007 | Light and Dark themes, density setting, native macOS menu | ✅ |
| SUB-008 | Open and play a video, with the subtitle shown on it | ✅ |
| SUB-009 | Select the subtitle under the playhead while playing | ✅ |
| SUB-010 | Find a subtitle (⌘F) | ✅ (replace is EDT-04, ⌥⌘F) |

---

## M1: Her daily driver (replace Subtitle Edit for her normal job)

Must-haves, from what her recording shows her doing. **Critical path:** ARC-01 → MED-01/02 → WAV-01 → WAV-02 → TIM-01/02 → FIL-01.

### Architecture

| ID | Feature | Size | Acceptance |
|---|---|---|---|
| ARC-01 | **Command registry**: every operation is one command (id, label, default keys, `isEnabled`, `run`). The native menu, shortcuts, right-click menus, waveform gestures and (later) the palette all call it. | M | ✅ Registry in `src/app/commands/`; menu bar built from it; scopes keep list-only keys away from text editing; ⌘⇧K palette. |

### Media layer (separate from the UI from day one)

| ID | Feature | Size | Acceptance |
|---|---|---|---|
| MED-01 | **Probe media in Rust** (bundled LGPL ffprobe): container, codecs, audio tracks, start-time offset, frame rate, **variable frame rate detection with real frame timestamps** | M | 🟡 UI + ffprobe/mdls probe shipped (QLT media info); bundled ffprobe + VFR timestamps still open. |
| MED-02 | **Playback path decision**: play the source directly when WebKit can; otherwise make a background **editing proxy** (H.264 via VideoToolbox) that keeps source timestamps. The original file is never modified. | L | Proxy is cached and reused. Subtitle times always refer to the source timeline. |
| MED-03 | **Frame-accurate stepping and snapping on the source's real frame timestamps** (not `1/fps`), so VFR footage is exact | M | ±1 frame lands on true frames in a VFR test clip. |
| MED-04 | **Media test corpus**: her actual previews (H.264 .mov/.mp4), an MKV, multi-audio, VFR phone footage, long 80-min file | S | Run before every media change. |

### Waveform & timing

| ID | Feature | SE reference | Size | Acceptance |
|---|---|---|---|---|
| WAV-01 | **Real waveform from the film's audio** | Audio visualizer | L | Rust decodes audio (symphonia, ffmpeg fallback), computes peaks, caches next to the video. An 81-min film's waveform appears in ≤5 s the first time and instantly afterwards. Sent to the UI as binary. ✅ symphonia (+ Opus via libopus) for AAC/MP3/PCM/FLAC/Vorbis/ALAC/Opus in MP4/MOV/MKV/WebM/OGG/WAV; ffmpeg PCM fallback for AC-3/E-AC-3/etc.; 100 peaks/s; cached by path+size+mtime. |
| WAV-02 | Drag a cue's edges to retime; drag the middle to move | Waveform mouse | M | ✅ ±5 px edge zones (ew-resize) / grab in the middle; clamped to prev.end / next.start with a 0.1 s minimum; ⌥-drag on an edge moves the neighbour's facing edge (keeps the gap); one undo step per gesture; pointer capture. |
| WAV-03 | Drag on empty waveform to mark a region; Enter/double-click creates a cue there | "New selection" | M | ✅ Drag in a gap marks a translucent region (kept inside that gap, so it never overlaps a cue); Enter or double-click inside creates a cue with exactly those times and focuses the text; Escape or a click elsewhere clears it. Also Waveform menu › Create subtitle from marked region. |
| WAV-04 | Click to seek; Shift+click sets start; Ctrl/⌘+click sets end | Waveform mouse | S | ✅ ⇧-click / ⌘-click (Ctrl on Windows/Linux) put the selected cue's start / end exactly at the click; the other edge only moves to keep 0.1 s. |
| WAV-05 | Zoom and scroll: wheel/trackpad pan, ⌘+wheel time zoom, ⌥+wheel amplitude, double-click centre, ⌥+double-click reset | Waveform mouse | S | ✅ |
| WAV-06 | Waveform right-click menu: insert / delete / split here / merge before or after | Waveform context menu | M | |
| WAV-07 | Snap to speech / seek silence; guess start/end from the waveform | Seek silence, guess times | M | Uses peaks from WAV-01. |
| WAV-08 | Spectrogram view (toggle) | Spectrogram | L | Later in M1, if she uses it. ❓ |

### Playback

| ID | Feature | SE reference | Size | Acceptance |
|---|---|---|---|---|
| PLY-01 | Frame-accurate stepping: ±1 frame, ±100 ms, ±500 ms, ±1 s keys | Video player keys | S | ✅ ←/→ ±1 frame (pauses, lands on the project-fps grid; real VFR timestamps come with MED), ⇧ ±100 ms, ⌘ ±500 ms, ⌃⇧ ±1 s. Playback › Step menu. |
| PLY-02 | Play current cue; loop selection; play from just before the cue | Waveform toolbar | S | Her most frequent action while timing. |
| PLY-03 | Playback speed that keeps pitch | Speed | S | ✅ `preservesPitch` + `webkitPreservesPitch` set with every rate change (and `defaultPlaybackRate`, so a new video keeps the speed). Faster / slower / normal commands in Playback › Speed. |
| PLY-04 | Proxy playback: see MED-02 | — | — | Moved to the media layer. |
| PLY-05 | Audio track picker (multi-track files) | Audio tracks | M | |
| PLY-06 | Subtitle preview style: font, size, outline, box | Subtitle preview properties | S | ✅ Size (scales with the video height), background box or outline (`preview-outline` token), vertical position incl. top; persisted app setting; toolbar view menu + View › Subtitle Preview commands. Font family not offered (Inter only). |
| PLY-08 | Seekable video progress bar (click/drag/hover time); clicking a subtitle row seeks the video; waveform recentres on off-screen seeks | Video player seek | S | ✅ |

### Editing

| ID | Feature | SE reference | Size | Acceptance |
|---|---|---|---|---|
| EDT-01 | **Set start / Set end at playhead** shortcuts (+ "set end and go to next") | Set start/end (F9–F12) | S | This is core to how SE users time on the fly. |
| EDT-02 | Insert before/after, delete, merge with next/previous, split at cursor/playhead | Grid context menu, split/join | M | ✅ Insert before/after/end; delete; duplicate; split at cursor/video; merge prev/next/selected (keep breaks / unbreak / dialog). Context menu later (WAV-06). |
| EDT-03 | Multi-select in the list (Shift/⌘-click) for bulk delete, shift times, merge | Grid selection | M | ✅ Multi-select, select all, invert; bulk delete via cut. Shift/merge later (EDT-02). |
| EDT-04 | Find & replace (whole word, case, regex), find next/prev | Find / Replace | M | ✅ ⌥⌘F non-modal dialog; ⌘G / ⇧⌘G find next/previous (wraps); match case, Unicode-aware whole word (tone marks stay in the word), regex with `$1` replacements and inline error; replace-all is one undo step. ⌘F palette unchanged. |
| EDT-05 | Go to line number (⌘G) | Go to line | S | |
| EDT-06 | Italic/bold toggles (⌘I) rendered in list and preview | Text editor | S | ✅ Italic toggle (⌘I); list + preview render. Bold is M2. |
| EDT-07 | Auto-break / unbreak lines; balance two lines | Auto-break, toggle break | M | ✅ Auto-break, unbreak, balance, toggle line break. |
| EDT-08 | Configurable shortcuts, with an "Import from Subtitle Edit" preset | Shortcuts | M | Her muscle memory is the selling point. ❓ Get her SE shortcut list. |

### Timing by keyboard (from SE's command set; this is how fast subtitlers actually work)

| ID | Feature | SE reference | Size | Acceptance |
|---|---|---|---|---|
| TIM-01 | **Hold-to-time:** hold a key while the line is spoken; press creates the cue at the playhead, release sets its end | InsertSubtitleAtVideoPositionSetEndAtKeyUp | M | Works while playing, then focuses text. |
| TIM-02 | **Set end, add new and go to new** / set start and go to next / set end and go to next | WaveformSetEndAddNewAndGoToNew etc. | S | ✅ Timing menu + F10 / Shift+F10 / set-start-go-next. |
| TIM-03 | Move start/end ±1 frame or ±X ms, with keep-gap and push-neighbour variants | MoveStart*/MoveEnd* | S | ✅ Global keys + Timing menu (plain / keepGap / push). |
| TIM-04 | Shift selected lines / all lines by a frame, X ms, or custom steps | MoveSelectedLines*, MoveAllLines* | S | ✅ Incl. “+ following” variant. |
| TIM-05 | Extend selected to previous/next cue; extend previous end or next start to selected | Extend* | S | ✅ Cue-to-cue; shot-change extend deferred (no shot detection). |
| TIM-06 | Set end and start of next after minimum gap; set start and end of previous minus gap | WaveformSetEndAndStartOfNextAfterGap | S | ✅ |
| TIM-07 | Snap all times to frames; get frame rate from the video | SnapAllTimesToFrames, GetFrameRateFromVideoFile | S | ✅ Snap done (project fps). Get fps from video still open. |

### Text moves & navigation

| ID | Feature | SE reference | Size | Acceptance |
|---|---|---|---|---|
| EDT-10 | Ripple delete; duplicate line; remove blank lines; trim whitespace | RippleDeleteSelectedLines… | S | ✅ |
| EDT-11 | Move first/last word between neighbouring cues; move text from cursor to next cue (and play) | MoveFirstWord*, MoveTextFromCursorToNext* | M | Re-split dialogue without retyping. |
| EDT-12 | Toggle dialog dashes; break at first space from cursor | ToggleDialogDashes, BreakAtFirstSpaceFromCursor | S | ✅ |
| NAV-01 | Go to next/previous **error**, next empty line, next line from video position | GoToNextError… | S | |
| NAV-02 | Bookmarks (with note): toggle, list, next/previous | Bookmarks | M | ✅ ⌘B toggle, ⇧⌘B note, ⌥⌘B / ⇧⌥⌘B next/previous (wrap), searchable list (Edit › Bookmarks); stored on the cue in the subtitle store (undoable); bookmark icon in the list row. Persisted via FIL-03 sidecar. |
| NAV-03 | Focus shortcuts between list, text box and waveform | ToggleFocus* | S | |
| PLY-07 | Play next/previous cue (stop or loop); play from just before the text; go to next line and play | PlayNext*, VideoPlayFromJustBeforeText, GoToNextSubtitlePlayTranslate | S | The listen-then-type loop. |
| PRV-01 | Screen privacy toggle (hides file names, then text) | ToggleScreenPrivacy | S | ✅ Cycles off → names → text (⌘⇧P). |

### Files & safety

| ID | Feature | SE reference | Size | Acceptance |
|---|---|---|---|---|
| FIL-01 | **Autosave + crash recovery** | Auto-backup | M | ✅ Periodic auto-backup (default 60s / keep 30); restore dialog + launch toast. |
| FIL-02 | Recent files; reopen the last project with its video | Recent files | S | ✅ Recent subtitles (with video path) + videos; clear recent. |
| FIL-03 | Project sidecar (video path, waveform cache, settings) next to the .srt | — | M | |
| FIL-04 | Encoding detection for legacy files (Windows-1252, etc.) + manual encoding pick | Import with encoding | S | ✅ Manual encoding pick (detection still open). |
| FIL-05 | Reload when changed outside the app | Reload when changed | S | ✅ Mtime poll; ask to reload. |
| FIL-06 | Drag and drop video/subtitle onto the window | — | S | ✅ Tauri webview drag-drop; routes .srt/.vtt and .mp4/.mov/.m4v/.webm to the open logic (subtitle keeps the current video); overlay says what will open. |
| FIL-07 | ❓ **Script / "original" column**: show a source document (her Google Doc script) beside each cue | Translation mode ("Open original subtitle") | L | SE's translation mode may be exactly what her Google Docs workflow needs. Confirm with her. |

### Script workflow (M1 candidate; investigate first)

| ID | Feature | SE reference | Size | Acceptance |
|---|---|---|---|---|
| SCR-00 | ❓ **Ask her:** what's in the Google Doc, who makes it, does it match the film line by line? | — | — | Decides SCR-01 and the AI order. |
| SCR-01 | **Import a script** (.docx / .txt / pasted Google Doc text): split into lines (one per sentence or paragraph, editable rules), create untimed cues | Import plain text | M | Untimed cues are clearly marked. Nothing is lost on import. |
| SCR-02 | **Line-by-line timing pass** over imported lines: play, then hold-to-time (TIM-01) or set start/end + auto-advance (TIM-02) | — | S | A 5-minute scene can be timed in roughly real time. Builds on TIM-01/02. |

### Quality rules

| ID | Feature | SE reference | Size | Acceptance |
|---|---|---|---|---|
| RUL-02 | List errors panel (every flagged cue, click to jump) | List errors | S | ✅ Non-modal panel (View › List errors, or the toolbar ⚠ count): one row per flagged cue and column with its reason; click jumps and seeks; recomputed live from `checkCue`. |
| RUL-03 | Words-per-minute and gap columns (optional columns) | Grid columns | S | ✅ CPS + Gap columns (toggleable). WPM is M2. |

---

## M2: Quality tools (make her faster than she is in SE)

| ID | Feature | SE reference | Size |
|---|---|---|---|
| QLT-01 | Fix common errors (overlaps, short gaps, double spaces, missing periods, dialog dashes…) with preview | Fix common errors | L |
| QLT-02 | Beautify / snap time codes to frames; apply min gap; bridge gaps; duration limits | Beautify, Bridge gaps… | M |
| QLT-03 | **Early M2.** Spell check (English) with **names list and user dictionary** (Yoruba names, places, slang) and a live underline | Spell check | L |
| RUL-01 | Rule profiles per client (min/max duration, CPS, line length, min gap, max lines) incl. a Netflix preset. M1 ships fixed default warnings. | Settings → Rules | M |
| QLT-09 | Command palette (⌘⇧K); nearly free once ARC-01 exists | Command palette | S | ✅ Shipped with ARC-01 |
| QLT-04 | Multiple replace (saved rule sets) | Multiple replace | M |
| QLT-05 | Change casing; merge short lines; merge same text/time | Tools menu | M |
| QLT-06 | Remove text for hearing impaired | Remove HI | M |
| QLT-07 | Statistics dashboard (CPS histogram, totals) | Statistics | S | ✅ |
| QLT-08 | Compare two subtitle files | Compare | M | ✅ |
| SYN-01 | Adjust all times (offset selected or all) | Adjust all times | S |
| SYN-02 | Visual sync / point sync | Visual sync | L |
| SYN-03 | Change frame rate; change speed | Sync menu | S |
| SYN-04 | Shot-change detection (ffmpeg) + snapping | Shot changes | L |

---

## M3: Formats & delivery

| ID | Feature | SE reference | Size |
|---|---|---|---|
| FMT-01 | Advanced SubStation (ASS/SSA) read/write, basic styles | ASSA | L |
| FMT-02 | TTML/DFXP, SBV, Final Cut Pro XML, Premiere/DaVinci markers | Formats | M each |
| FMT-03 | Custom text export (templates) | Export custom text | M |
| DLV-01 | Burn subtitles into video (ffmpeg, hardware encode) | Burn-in | L |
| DLV-02 | Embed subtitles as a track (mux) | Embed subtitles | M |
| DLV-03 | Batch convert (folder → format, with chained fixes) | Batch convert | L |
| DLV-04 | Signed + notarised macOS builds, auto-update | Updates | M |

---

## M4: AI (after the manual workflow is solid, per our decision)

**Order:** controlled per-line suggestions (AI-03) come first, because she stays in charge of every line. Suggestions need Yoruba **text**, though. If she has a Yoruba script (SCR-00), AI-03 needs no speech-to-text. If not, AI-02's transcription has to come first.

| ID | Feature | SE reference | Size |
|---|---|---|---|
| AI-01 | Spike: test Yoruba speech-to-text and translation on her real clips; measure correction time vs typing | — | M |
| AI-03 | **First AI milestone:** per-line suggestions (1–3 options) with surrounding context; accept, edit or reject | AI assistant | L |
| AI-02 | Yoruba audio → timed English first draft (selected range or whole film) | Speech to text | L |
| AI-04 | Translation memory from her approved past films | — | L |
| AI-05 | AI proofreading pass (typos, punctuation) | AI review | M |
| AI-06 | Speaker detection (diarisation) | Detect speakers | L |

---

## Parked (not planned; SE has them, she likely doesn't need them)

Image-subtitle OCR (Blu-ray/DVD/VobSub) · Burned-in subtitle OCR · DVD import · Blu-ray/DCP image exports · EBU STL/PAC/Cavena broadcast formats · Text-to-speech, voice cloning, dubbing · Background music generation · Video cut/remux/re-encode · Chapters editor · ASSA drawing, effects, karaoke, font embedding · Plugins · RTL language tools · 380-format coverage · Command-line converter (seconv) · Proxy/network settings · UI translations.

Revisit when selling to a wider audience (Pidgin, Nigerian English creators, TikTok/short-form).
