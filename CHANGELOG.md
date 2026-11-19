# Changelog

Each `## x.y.z` section becomes the notes of that GitHub release (`pnpm release x.y.z` refuses to tag without one). Write for the person subtitling, not for developers.

## 0.1.0

The first preview build. Substudio is an early, keyboard-first subtitle editor for feature films, built around the way a professional Nollywood subtitler works today in Subtitle Edit. Everything runs on your Mac; nothing is uploaded.

**Open and save**
- SubRip (.srt), WebVTT, Advanced SubStation (.ass/.ssa), SBV and TTML, with old encodings detected automatically.
- Autosave, crash recovery, recent files, and a project file beside your .srt that reopens the film exactly where you stopped.
- Drag a video or subtitle file onto the window to open it.

**Video and waveform**
- Plays the film with the subtitle drawn on top; frame-accurate stepping on the film's real frame times.
- A real waveform (and a spectrogram) from the film's audio. Drag on it to make a cue, drag edges to retime, right-click to insert, split or merge.
- Shot-change detection with snapping, playback speed that keeps pitch, and a picker for multi-track audio.

**Editing at speed**
- Every action has a shortcut, including a Subtitle Edit shortcut preset, and the ⌘⇧K command palette finds the rest.
- Hold-to-time, set start/end at the playhead, set end and go to the next line, nudge by frames, shift lines.
- Paste a script from a Google Doc and time it line by line, with the original text beside each cue.
- Find and replace, multiple replace, spell check with your own names list, fix common errors, and a list of every problem cue.
- Timecodes in frames (25 fps by default) or milliseconds.

**Delivering**
- Burn subtitles into a video, embed them as a track, or batch-convert a folder of files.

**Known limits of this preview**
- The app is not notarised by Apple yet, so macOS asks you to allow it once (see the download page).
- No automatic updates yet: download new versions from the website.
- No AI features yet. That comes after the editor is right.
