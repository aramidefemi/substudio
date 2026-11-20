(() => {
  "use strict";

  const nav = [
    {
      title: "Getting started",
      open: true,
      pages: [
        { slug: "overview", title: "Overview", section: "Getting started" },
        { slug: "install", title: "Install on macOS", section: "Getting started" },
        { slug: "first-project", title: "Your first project", section: "Getting started" },
        { slug: "workspace", title: "The workspace", section: "Getting started" },
      ],
    },
    {
      title: "Editing",
      pages: [
        { slug: "files-formats", title: "Files and formats", section: "Editing" },
        { slug: "text-lines", title: "Text and line editing", section: "Editing" },
        { slug: "search-navigation", title: "Search and navigation", section: "Editing" },
        { slug: "playback", title: "Video and playback", section: "Editing" },
        { slug: "waveform", title: "Waveform and spectrogram", section: "Editing" },
        { slug: "timing", title: "Timing subtitles", section: "Editing" },
      ],
    },
    {
      title: "Professional tools",
      pages: [
        { slug: "synchronization", title: "Synchronization", section: "Professional tools" },
        { slug: "quality", title: "Quality rules and errors", section: "Professional tools" },
        { slug: "spell-check", title: "Spell check", section: "Professional tools" },
        { slug: "bulk-tools", title: "Clean-up and bulk tools", section: "Professional tools" },
        { slug: "translation", title: "Auto-translate", section: "Professional tools" },
        { slug: "original-text", title: "Original text workflow", section: "Professional tools" },
        { slug: "video-delivery", title: "Burn-in and embedding", section: "Professional tools" },
        { slug: "projects-recovery", title: "Projects, history and recovery", section: "Professional tools" },
        { slug: "customization", title: "Appearance and shortcuts", section: "Professional tools" },
      ],
    },
    {
      title: "Tutorials",
      pages: [
        { slug: "tutorial-create", title: "Create subtitles from scratch", section: "Tutorials" },
        { slug: "tutorial-translate", title: "Translate a whole film", section: "Tutorials" },
        { slug: "tutorial-resync", title: "Repair offset and drift", section: "Tutorials" },
        { slug: "tutorial-quality", title: "Run a quality-control pass", section: "Tutorials" },
        { slug: "tutorial-deliver", title: "Deliver subtitles and video", section: "Tutorials" },
      ],
    },
    {
      title: "Reference",
      pages: [
        { slug: "shortcuts", title: "Keyboard shortcuts", section: "Reference" },
        { slug: "formats", title: "Supported formats", section: "Reference" },
        { slug: "privacy", title: "Privacy and network use", section: "Reference" },
        { slug: "faq", title: "FAQ", section: "Reference" },
      ],
    },
  ];

  const pages = {
    overview: {
      description:
        "Substudio is a fast, keyboard-first subtitle editor for macOS, designed around the real work of timing, translating and delivering full-length films.",
      keywords: "features subtitle editor mac overview long films",
      html: `
        <div class="callout tip"><strong>These docs follow the current preview.</strong><p>Every page describes a feature that exists in the app today. Where a workflow sends data off your Mac, the docs say so explicitly.</p></div>

        <h2>What Substudio is for</h2>
        <p>Substudio keeps the core subtitling loop close together: watch the picture, listen to the line, edit the text, set exact frame-aligned times and move on. The interface stays responsive on long films with thousands of cues, while the waveform and quality checks make timing problems visible before delivery.</p>

        <div class="workspace-map" aria-label="Diagram of the Substudio workspace">
          <div class="toolbar-map"><span><strong>Toolbar</strong>Files · search · view · problems · undo · export</span></div>
          <div><span><strong>Video and subtitle preview</strong>Picture, playhead and playback controls</span></div>
          <div><span><strong>Subtitle list and editor</strong>Times, original text, translation and live quality feedback</span></div>
          <div class="waveform-map"><span><strong>Waveform or spectrogram</strong>Audio, cue regions, shot changes and frame-precise dragging</span></div>
        </div>

        <h2>Core capabilities</h2>
        <div class="feature-grid">
          <section><h3>Edit a whole film</h3><p>Virtualized cue list, multi-selection, find and replace, bookmarks, undo history and keyboard navigation.</p></section>
          <section><h3>Time to picture and sound</h3><p>Real media waveform, spectrogram, frame stepping, draggable regions, hold-to-time and shot-change snapping.</p></section>
          <section><h3>Translate beside the source</h3><p>Original and translation columns, Google auto-translate, machine-draft markers and an accept-and-review loop.</p></section>
          <section><h3>Check before delivery</h3><p>Reading speed, duration, line length, overlap and gap rules with built-in and custom client profiles.</p></section>
          <section><h3>Recover your work</h3><p>Project sidecars, recent files, undo history, external-change detection and automatic backups.</p></section>
          <section><h3>Deliver the result</h3><p>SRT, WebVTT, ASS/SSA, SBV and TTML/DFXP export, batch conversion, burn-in and embedded tracks.</p></section>
        </div>

        <h2>Start here</h2>
        <div class="cards">
          <a class="card" href="?page=first-project"><strong>Open your first film</strong><span>Load subtitles and video, understand the project files and save safely.</span></a>
          <a class="card" href="?page=tutorial-create"><strong>Create subtitles from scratch</strong><span>Build a timed subtitle track directly from dialogue or a prepared script.</span></a>
          <a class="card" href="?page=tutorial-translate"><strong>Translate a film</strong><span>Keep source text beside your translation and review machine drafts deliberately.</span></a>
          <a class="card" href="?page=shortcuts"><strong>Learn the keyboard workflow</strong><span>The small set of commands that removes hundreds of clicks from a long film.</span></a>
        </div>

        <h2>System requirements</h2>
        <ul>
          <li>macOS 11 or later.</li>
          <li>An Apple Silicon or Intel Mac; separate disk images are provided for each.</li>
          <li>Enough free disk space for the source video, generated waveform data and any temporary proxy video.</li>
        </ul>
        <p>The release includes the media tools used by Substudio. You do not need to install a separate programming runtime to use the app.</p>
      `,
    },

    install: {
      description:
        "Download the correct Mac build, install the preview and handle macOS’s first-launch security prompt.",
      keywords: "download dmg apple silicon intel quarantine gatekeeper install",
      html: `
        <h2>Choose the right download</h2>
        <p>Open <a href="../index.html#download">the download section</a> and choose the disk image for your Mac:</p>
        <ul>
          <li><strong>Apple Silicon</strong> for Macs with an M1, M2, M3, M4 or newer Apple chip.</li>
          <li><strong>Intel</strong> for older Macs that list an Intel processor.</li>
        </ul>
        <p>If you are unsure, choose <strong>Apple menu → About This Mac</strong> and read the Chip or Processor line.</p>

        <h2>Install the app</h2>
        <ol class="steps">
          <li><strong>Open the downloaded <code>.dmg</code>.</strong>Drag Substudio into the Applications folder shown in the window.</li>
          <li><strong>Launch it from Applications.</strong>The current preview is not yet notarised, so macOS may block the first launch. Click <strong>Done</strong>.</li>
          <li><strong>Allow the preview once.</strong>Open <strong>System Settings → Privacy &amp; Security</strong>, scroll to the security message for Substudio and click <strong>Open Anyway</strong>.</li>
          <li><strong>Confirm Open.</strong>macOS remembers the choice for this copy of the app.</li>
        </ol>

        <div class="callout warning"><strong>Why does macOS ask?</strong><p>The preview has not completed Apple notarisation. The prompt is about distribution signing; it does not mean macOS found malware. Download releases only from the Substudio GitHub repository or this website.</p></div>

        <h2>Terminal alternative</h2>
        <p>If you are comfortable in Terminal, remove the downloaded-file quarantine flag after copying the app:</p>
        <pre><code>xattr -dr com.apple.quarantine /Applications/Substudio.app</code></pre>

        <h2>Updating</h2>
        <p>Substudio does not update itself yet. Download the newer disk image, quit the existing app and replace Substudio in Applications. Your subtitle files, sidecar projects, preferences, word lists and backups are stored separately and are not removed when the application is replaced.</p>
      `,
    },

    "first-project": {
      description:
        "Open subtitles and video, let Substudio restore the project state, and learn what gets saved where.",
      keywords: "open video subtitle drag drop save project sidecar recent",
      html: `
        <h2>Open existing subtitles</h2>
        <ol class="steps">
          <li><strong>Open the subtitle file.</strong>Choose <strong>File → Open subtitles…</strong>, press <kbd>⌘ O</kbd>, or drop a supported subtitle file onto the window.</li>
          <li><strong>Open the matching video.</strong>Choose <strong>File → Open video…</strong> or press <kbd>⌘ ⇧ O</kbd>. You can also drop the subtitle and video together.</li>
          <li><strong>Check the frame rate.</strong>Substudio probes the media and uses real frame timestamps when available, including variable-frame-rate footage.</li>
          <li><strong>Edit and save.</strong>Press <kbd>⌘ S</kbd>. Save As defaults to SRT; the File menu exposes every other export format.</li>
        </ol>

        <div class="callout tip"><strong>Keep the video open.</strong><p><strong>New keeping video</strong> and <strong>Open keeping video</strong> let you switch subtitle documents without reloading a large film.</p></div>

        <h2>Start without a subtitle file</h2>
        <p>Open the video, choose <strong>File → New keeping video</strong>, then create cues at the playhead or drag a region on the waveform. If you already have a dialogue script, use <strong>File → Import plain text…</strong>. Each non-empty line becomes an untimed cue ready for a timing pass.</p>

        <h2>What a project remembers</h2>
        <p>Once the subtitle has a path, Substudio writes a small <code>.substudio.json</code> sidecar beside it. The sidecar remembers editor-only state that subtitle formats cannot carry reliably, including the video path, chosen audio track, frame rate, bookmarks, selected line, shot changes, the active rule profile and machine-translation review marks.</p>
        <p>The subtitle remains the deliverable. If the sidecar is missing or damaged, Substudio still opens the subtitle normally.</p>

        <h2>Reopening work</h2>
        <p>Use <strong>File → Recent files…</strong> to reopen a subtitle and its associated video. If the entire folder moved, Substudio also tries to find the remembered video beside the subtitle rather than relying only on the old absolute path.</p>

        <h2>Unsaved changes</h2>
        <p>Substudio asks before New, Open or Quit would discard edits. It also watches the subtitle file: when another application changes it on disk, you can reload deliberately instead of silently overwriting that version.</p>
      `,
    },

    workspace: {
      description: "Learn how the toolbar, video, cue list, text editor and audio timeline work together.",
      keywords: "interface main window toolbar list columns editor panels waveform video",
      html: `
        <h2>The toolbar</h2>
        <p>The toolbar keeps frequent actions visible without turning the window into a wall of buttons. File actions, find and view controls are grouped on the left. Problems, undo/redo and export are grouped on the right. Less frequent commands live in the macOS menu bar and the command palette.</p>

        <h2>Video and preview</h2>
        <p>The video panel shows the current cue using your selected preview background, size and vertical position. Playback controls expose play/pause, seeking, speed and full screen. The preview is not permanently burned into the film; it is a working view of the subtitle at the current playhead position.</p>

        <h2>Subtitle list</h2>
        <p>Each row represents one cue. The core columns are number, start, end, duration and text. Optional columns show characters per second, the gap from the previous cue and original-language text. Problem cells are highlighted from the active quality profile.</p>
        <ul>
          <li>Click a row to select it; use Shift and Command for ranges or multiple lines.</li>
          <li>Use <kbd>↑</kbd> and <kbd>↓</kbd> outside the text field to move through the list.</li>
          <li>Press <kbd>Enter</kbd> to move into the text editor.</li>
          <li>Choose compact or comfortable row density from the View menu.</li>
        </ul>

        <h2>Cue editor</h2>
        <p>The editor shows start, end, duration, text statistics and the text itself. It fills the available panel height, so resizing the divider gives more room to either the list or the current cue. Time fields accept normal timecode input and can display frames or milliseconds.</p>

        <h2>Waveform and spectrogram</h2>
        <p>The lower timeline is generated from the video’s actual audio. Cue regions align the subtitle track to the sound. You can seek, select empty ranges, create cues and adjust start, end or the entire cue directly. Switch to the spectrogram when frequencies make dialogue boundaries easier to see.</p>

        <h2>Focus without the mouse</h2>
        <table>
          <thead><tr><th>Area</th><th>Shortcut</th><th>Use it for</th></tr></thead>
          <tbody>
            <tr><td>Subtitle list</td><td><kbd>⌘ 1</kbd></td><td>Selecting and moving whole cues</td></tr>
            <tr><td>Text editor</td><td><kbd>⌘ 2</kbd></td><td>Typing and formatting the current subtitle</td></tr>
            <tr><td>Waveform</td><td><kbd>⌘ 3</kbd></td><td>Keyboard waveform navigation and timing</td></tr>
            <tr><td>Any command</td><td><kbd>⌘ ⇧ K</kbd></td><td>Searching the command palette by name</td></tr>
          </tbody>
        </table>
      `,
    },

    "files-formats": {
      description:
        "Open, import, save, export and batch-convert subtitle files without changing your originals unexpectedly.",
      keywords: "srt vtt webvtt ass ssa sbv ttml dfxp encoding batch convert export custom text",
      html: `
        <h2>Supported subtitle formats</h2>
        <div class="pill-row"><span class="pill">SubRip (.srt)</span><span class="pill">WebVTT (.vtt)</span><span class="pill">ASS (.ass)</span><span class="pill">SSA (.ssa)</span><span class="pill">YouTube SBV (.sbv)</span><span class="pill">TTML (.ttml)</span><span class="pill">DFXP (.dfxp)</span></div>
        <p>Substudio detects these formats when opening or dropping a file. Saving preserves the current file’s format; <strong>Save as…</strong> creates SRT, while the dedicated export commands create the other formats.</p>

        <h2>Import with a legacy encoding</h2>
        <p>Normal Open expects UTF-8 but also detects common Windows-1252 files. If names or punctuation appear corrupted, choose <strong>File → Import with encoding…</strong> and select the source encoding explicitly. Save the result as a modern UTF-8 subtitle.</p>

        <h2>Import plain text</h2>
        <p>Plain-text import turns each non-empty line into an untimed cue. It is intended for prepared dialogue, transcripts and translation scripts. Untimed cues participate in text quality checks but do not trigger duration, overlap or reading-speed errors until you assign times.</p>

        <h2>Export selected lines</h2>
        <p>Select a range and choose <strong>File → Save selected lines as…</strong> to create a separate SRT containing only those cues. This is useful for review excerpts, pickups or dividing work without altering the main document.</p>

        <h2>Custom text export</h2>
        <p>Custom text presets turn each cue into a repeatable template. Use placeholders for the cue number, start, end, duration, text or original text, and choose a separator between cues. This supports spotting lists, dialogue sheets and handoff formats without adding another subtitle parser.</p>

        <h2>Batch conversion</h2>
        <ol class="steps">
          <li><strong>Choose File → Batch convert…</strong>Add individual subtitle files or a folder.</li>
          <li><strong>Choose the output format.</strong>The same seven text formats are available.</li>
          <li><strong>Optionally shift every cue.</strong>Enter a positive or negative offset in milliseconds.</li>
          <li><strong>Choose a destination folder and convert.</strong>Original files are never overwritten. Failures are listed per file while the rest continue.</li>
        </ol>
        <div class="callout tip"><strong>Need the exact format matrix?</strong><p>See <a href="?page=formats">Supported formats</a> for which features each format can carry.</p></div>
      `,
    },

    "text-lines": {
      description:
        "Edit subtitle text quickly, keep line breaks readable, and split or merge cues without losing timing context.",
      keywords: "italic line break auto break merge split dialog dashes trim duplicate ripple delete",
      html: `
        <h2>Editing text</h2>
        <p>Select a cue and type in the text editor. Changes join the undo history, and live statistics show length, duration and reading speed. Substudio treats subtitle line breaks as deliberate formatting, not ordinary word wrapping.</p>

        <h3>Formatting and line breaks</h3>
        <table>
          <thead><tr><th>Action</th><th>What it does</th><th>Default shortcut</th></tr></thead>
          <tbody>
            <tr><td>Italic</td><td>Wraps or unwraps the selection or line with SRT-style <code>&lt;i&gt;</code> tags.</td><td><kbd>⌘ I</kbd></td></tr>
            <tr><td>Toggle line break</td><td>Adds a break at the cursor, or removes the existing break.</td><td><kbd>⌘ ⇧ L</kbd></td></tr>
            <tr><td>Auto-break</td><td>Finds a readable two-line break using the active line-length rule.</td><td><kbd>⌘ R</kbd></td></tr>
            <tr><td>Unbreak</td><td>Joins wrapped text into one line.</td><td><kbd>⌘ ⇧ R</kbd></td></tr>
            <tr><td>Dialog dashes</td><td>Adds or removes leading dashes for a two-speaker cue.</td><td><kbd>⌘ ⇧ D</kbd></td></tr>
          </tbody>
        </table>
        <p><strong>Balance lines</strong> moves the break toward a visually even pair. <strong>Break at first space</strong> uses the first suitable space after the cursor, which is useful when you already know where the second thought begins.</p>

        <h2>Create and remove cues</h2>
        <ul>
          <li>Insert before, after, at the end or at the current playhead.</li>
          <li>Duplicate selected lines when timing or structure should be reused.</li>
          <li>Delete selected lines normally, or use <strong>Ripple delete</strong> to close the removed time by shifting later cues.</li>
          <li>Remove every blank cue in one operation.</li>
        </ul>

        <h2>Split a cue</h2>
        <p><strong>Split at cursor</strong> divides text where you are typing and divides the cue duration proportionally. <strong>Split at video position</strong> uses the playhead as the timing boundary. For a listening workflow, move text after the cursor into the next cue, optionally playing that next cue immediately.</p>

        <h2>Merge cues</h2>
        <p>Merge with the previous cue, the next cue or every selected cue. For each direction, choose how text is combined:</p>
        <ul>
          <li><strong>Keep breaks</strong> preserves the existing line structure.</li>
          <li><strong>Unbreak</strong> joins the text with normal spaces.</li>
          <li><strong>As dialog</strong> formats the two parts as separate dash-led speakers.</li>
        </ul>
        <p>The merged cue begins at the earliest start and ends at the latest end. Quality highlighting updates immediately so you can see whether the result is too long or too fast.</p>

        <h2>Move words between cues</h2>
        <p>When a split falls one word too early or late, use <strong>Move first word from next line</strong>, <strong>Move last word to next line</strong>, or move all text after the cursor to the next cue. These operations retain both cues and are faster than cut-and-paste while reviewing dialogue.</p>
      `,
    },

    "search-navigation": {
      description:
        "Find text, replace safely, jump between problems and bookmarks, and run any action from the command palette.",
      keywords: "find replace regex command palette bookmark history next error go to line",
      html: `
        <h2>Find subtitles</h2>
        <p>Press <kbd>⌘ F</kbd> or <kbd>⌘ K</kbd> to open Find. Searches move through cue text and wrap around the document. Use <kbd>⌘ G</kbd> for the next match and <kbd>⌘ ⇧ G</kbd> for the previous one.</p>

        <h2>Find and replace</h2>
        <p>Press <kbd>⌘ ⌥ F</kbd> for Replace. You can match case, whole words or a regular expression. Replace the current match first when testing a pattern; use Replace All only after the preview matches what you intended. The whole operation is undoable.</p>

        <h2>Jump to work</h2>
        <table>
          <thead><tr><th>Destination</th><th>How</th></tr></thead>
          <tbody>
            <tr><td>Specific cue number</td><td><kbd>⌘ L</kbd> and enter the displayed line number</td></tr>
            <tr><td>Next or previous problem</td><td><kbd>⌘ ⌥ ↓</kbd> / <kbd>⌘ ⌥ ↑</kbd></td></tr>
            <tr><td>Next empty cue</td><td>Edit → Go To → Next Empty Line</td></tr>
            <tr><td>Cue after the playhead</td><td><kbd>⌥ ↓</kbd></td></tr>
            <tr><td>Cue before the playhead</td><td><kbd>⌥ ↑</kbd></td></tr>
          </tbody>
        </table>

        <h2>Bookmarks</h2>
        <p>Bookmarks mark lines you need to revisit without changing subtitle text. Press <kbd>⌘ B</kbd> to toggle one and <kbd>⌘ ⇧ B</kbd> to attach a note such as “check proverb with director.” The Bookmarks window lists every mark; dedicated next and previous commands let you run a review pass in document order.</p>

        <h2>Command palette</h2>
        <p>Press <kbd>⌘ ⇧ K</kbd> and type part of an action: “shot,” “merge,” “privacy,” “original,” or “translate.” The palette exposes commands that are intentionally not crowded into the toolbar and shows the current shortcut where one exists.</p>

        <h2>Undo history</h2>
        <p><strong>Edit → Show history…</strong> displays named editing steps instead of limiting you to blind repeated Undo. Translation batches, bulk clean-ups and other multi-line operations are recorded as coherent steps.</p>
      `,
    },

    playback: {
      description:
        "Review dialogue with precise seeking, frame stepping, playback ranges, speed control and multi-track audio.",
      keywords: "video play pause frame step loop selection speed audio track vfr variable frame rate proxy",
      html: `
        <h2>Open and inspect media</h2>
        <p>Choose <strong>File → Open video…</strong> or drop a video with its subtitle. Substudio probes duration, dimensions, frame rate, individual frame timestamps and audio tracks. <strong>File → Media information…</strong> shows the container, codecs, start offset, frame count and whether the video is variable frame rate.</p>

        <h2>Playback commands</h2>
        <table>
          <thead><tr><th>Action</th><th>Shortcut</th></tr></thead>
          <tbody>
            <tr><td>Play or pause</td><td><kbd>Space</kbd> outside the text editor</td></tr>
            <tr><td>Play selected cue</td><td><kbd>F5</kbd></td></tr>
            <tr><td>Loop selected cue</td><td><kbd>⇧ F5</kbd></td></tr>
            <tr><td>Play from just before the cue</td><td><kbd>F6</kbd></td></tr>
            <tr><td>Play previous / next cue</td><td><kbd>F7</kbd> / <kbd>F8</kbd></td></tr>
            <tr><td>Loop previous / next cue</td><td><kbd>⇧ F7</kbd> / <kbd>⇧ F8</kbd></td></tr>
            <tr><td>Go to next cue and play</td><td><kbd>⌘ ⇧ ↩</kbd></td></tr>
          </tbody>
        </table>

        <h2>Precise stepping</h2>
        <p>Outside text fields, use <kbd>←</kbd> and <kbd>→</kbd> for one frame. Add Shift for 100 ms, Command for 500 ms, or Control+Shift for one second. Frame stepping uses the probed frame timestamps rather than assuming that every frame in a variable-frame-rate file has equal duration.</p>

        <h2>Playback speed</h2>
        <p>Use the Playback menu or command palette to slow down, speed up or return to normal speed. Slower playback helps with dense dialogue; faster playback is useful during a final continuity pass.</p>

        <h2>Audio tracks</h2>
        <p>For films with multiple languages, mixes or commentary tracks, choose the working track from <strong>Playback → Audio Track</strong>. The selected ordinal is stored in the project sidecar and is also used when generating waveform data.</p>

        <h2>Media compatibility and proxies</h2>
        <p>When the native player cannot play a source container or codec smoothly, Substudio can prepare a local proxy while keeping timing anchored to the source. Proxies and waveform caches are derived working files; they do not modify the film.</p>
      `,
    },

    waveform: {
      description:
        "See the film’s real audio, seek and zoom through it, and time cue regions by dragging sound-aligned boundaries.",
      keywords:
        "audio visualizer waveform spectrogram zoom drag edge region selection context menu shot changes",
      html: `
        <h2>Generate the audio view</h2>
        <p>When you open a video, Substudio builds waveform peaks from the selected audio track and caches them by file identity. The timeline is therefore the film’s real audio, not a decorative sample. Switch between waveform and spectrogram from the Waveform menu.</p>

        <h2>Waveform or spectrogram?</h2>
        <p>The waveform shows loudness over time and is usually the fastest view for dialogue starts and pauses. The spectrogram shows energy by frequency, which can make speech visible under music or reveal consonant boundaries that have similar volume. Both use the same playhead and subtitle regions.</p>

        <h2>Navigate</h2>
        <ul>
          <li>Click to seek the video.</li>
          <li>Scroll horizontally through the film and zoom for finer timing.</li>
          <li>Centre the selected subtitle when the playhead and list become separated.</li>
          <li>Use the waveform focus shortcut <kbd>⌘ 3</kbd> before keyboard waveform commands.</li>
        </ul>

        <h2>Adjust existing cues</h2>
        <p>Drag the left edge to change the start, the right edge to change the end, or the middle to move the whole cue without changing its duration. Linked dragging can also move the neighbouring boundary, helping preserve a required gap rather than creating a new overlap.</p>

        <h2>Create from a region</h2>
        <ol class="steps">
          <li><strong>Drag across empty audio.</strong>The selected range becomes a temporary region.</li>
          <li><strong>Choose Create subtitle from region.</strong>A cue is inserted with those exact bounds.</li>
          <li><strong>Type or paste the dialogue.</strong>You can also paste clipboard text directly into the selected region.</li>
        </ol>

        <h2>Context actions</h2>
        <p>Right-click the waveform or a cue region for timing actions near the sound: create, paste, clear the selected region, split at the pointer, merge, delete, set a boundary or copy timing information. The same operations remain available from menus and the command palette.</p>

        <h2>Shot-change guides</h2>
        <p>Generated shot changes appear as timeline markers and safe zones. Use them as editorial guides: snap selected cue edges when a cut is close, navigate to the previous or next cut, or toggle a marker manually when the detector missed one.</p>
      `,
    },

    timing: {
      description:
        "Set and refine cue boundaries by frame, by playhead, by dragging, or in a continuous keyboard timing pass.",
      keywords: "set start end f9 f10 f11 f12 hold h nudge frame gap push snap frames timing",
      html: `
        <h2>Choose the right timing method</h2>
        <div class="feature-grid">
          <section><h3>While listening</h3><p>Set cue starts and ends at the video playhead with function keys, or hold one key for the spoken duration.</p></section>
          <section><h3>While looking</h3><p>Drag cue edges against the waveform, spectrogram and shot-change markers.</p></section>
          <section><h3>For exact corrections</h3><p>Edit time fields or nudge one frame, 100 ms, a custom amount, or an entire selected block.</p></section>
          <section><h3>For global repairs</h3><p>Use Adjust Times, Visual Sync, frame-rate conversion or speed conversion rather than moving cues one by one.</p></section>
        </div>

        <h2>Time at the playhead</h2>
        <table>
          <thead><tr><th>Action</th><th>Shortcut</th><th>Behavior</th></tr></thead>
          <tbody>
            <tr><td>Set start</td><td><kbd>F11</kbd></td><td>Moves the selected cue’s start to the playhead.</td></tr>
            <tr><td>Set end</td><td><kbd>F12</kbd></td><td>Moves the selected cue’s end to the playhead.</td></tr>
            <tr><td>Set end and go next</td><td><kbd>F10</kbd></td><td>Closes the current cue and selects the following one.</td></tr>
            <tr><td>Set start and offset rest</td><td><kbd>F9</kbd></td><td>Moves the selected start and shifts following cues by the same delta.</td></tr>
            <tr><td>Set end, add new and go</td><td><kbd>⇧ F10</kbd></td><td>Finishes the current cue and creates the next working cue.</td></tr>
          </tbody>
        </table>

        <h2>Hold to time</h2>
        <p>Move the playhead to the beginning of dialogue, then hold <kbd>H</kbd>. Substudio creates a cue at key-down and sets its end when you release the key. This is the fastest way to make a rough timing pass when you already have the words or can type immediately afterward.</p>

        <h2>Nudge boundaries</h2>
        <p><kbd>⌥ ←</kbd> and <kbd>⌥ →</kbd> move the start by one frame. Add Shift to move the end. The Timing menu also exposes 100 ms and custom steps, plus variants that keep a gap or push a neighbour instead of allowing overlap.</p>

        <h2>Move groups</h2>
        <p>Select one or more cues and move them together by frame, 100 ms or a custom amount. “Selected and following” shifts the remainder of the film from the selection onward; “Move all” offsets the entire subtitle track.</p>

        <h2>Close gaps deliberately</h2>
        <p>Extend the selected cue to the previous or next cue, extend a neighbour to the selected cue, or chain the end of one cue to the next start using the active profile’s minimum gap. When a detected shot change lies in the gap, extension commands prefer that editorial boundary.</p>

        <h2>Snap to real frames</h2>
        <p><strong>Timing → Snap all times to frames</strong> aligns every start and end to actual frame timestamps. Run it after importing a millisecond-based file when your delivery requires frame-clean cuts.</p>
      `,
    },
  };

  Object.assign(pages, {
    synchronization: {
      description:
        "Repair a constant offset, linear drift, frame-rate mismatch or speed conversion without hand-moving every cue.",
      keywords: "sync offset visual sync drift frame rate speed shot changes pal ntsc",
      html: `
        <h2>Diagnose the mismatch first</h2>
        <p>Check a cue near the beginning and another near the end. If both are early or late by roughly the same amount, use <strong>Adjust times</strong>. If the error grows across the film, use <strong>Visual sync</strong>, <strong>Change frame rate</strong> or <strong>Change speed</strong>.</p>

        <h2>Adjust times by offset</h2>
        <p><strong>Sync → Adjust times by offset…</strong> shifts every cue or only the selected cues by a fixed positive or negative amount. The preview shows the new range and prevents negative start times. Use this for a different studio logo, a trimmed opening or a subtitle track that simply starts late.</p>

        <h2>Visual sync</h2>
        <p>Visual sync uses two anchors to calculate a linear correction. Match one subtitle near the beginning to the correct video time, then repeat near the end. Substudio maps every cue between those two points, correcting both offset and gradual drift.</p>
        <ol class="steps">
          <li><strong>Choose a clear early line.</strong>Speech onsets, doors closing or hard cuts make good anchors.</li>
          <li><strong>Set its correct video time.</strong>Play and frame-step until the moment is exact.</li>
          <li><strong>Choose a late line and set the second anchor.</strong>Use a point as far into the film as practical.</li>
          <li><strong>Review the calculated result.</strong>Check the beginning, middle and end before saving.</li>
        </ol>

        <h2>Change frame rate</h2>
        <p>Use frame-rate conversion when the subtitle was authored for one frame rate and the current video uses another. The operation scales cue times by the ratio between source and target frame rates. It is not the same as merely changing how timecodes are displayed.</p>

        <h2>Change speed</h2>
        <p>Speed conversion handles material that was physically sped up or slowed down, such as a film master converted between cinema and broadcast timing. Enter the old and new rates or the duration relationship, preview the end time, then apply.</p>

        <h2>Shot changes</h2>
        <p><strong>Generate shot changes</strong> analyses the video locally and stores markers in the project. Navigate between cuts, snap selected cues to nearby cuts, or toggle a cut manually at the playhead. Shot changes are guides, not automatic edits: Substudio changes subtitle timing only when you choose a snap command.</p>

        <div class="callout warning"><strong>Keep a reversible checkpoint.</strong><p>Synchronization operations are undoable, but save a copy before delivering a substantially retimed track. A wrong frame-rate conversion can look convincing near the first cue and fail much later.</p></div>
      `,
    },

    quality: {
      description:
        "Use client-specific rule profiles and the live error list to catch timing, readability and layout problems while you work.",
      keywords: "quality qc reading speed cps duration line length overlap gap netflix rules errors",
      html: `
        <h2>What Substudio checks</h2>
        <p>Every timed cue is evaluated against the active rule profile. Problem cells are highlighted in the list and collected in the Errors panel.</p>
        <table>
          <thead><tr><th>Rule</th><th>Default limit</th><th>Why it matters</th></tr></thead>
          <tbody>
            <tr><td>Duration</td><td>1–7 seconds</td><td>Prevents flashes and subtitles that linger too long.</td></tr>
            <tr><td>Reading speed</td><td>17 characters/second</td><td>Flags text viewers may not finish.</td></tr>
            <tr><td>Line length</td><td>42 characters</td><td>Protects readable line width.</td></tr>
            <tr><td>Line count</td><td>2 lines</td><td>Avoids tall subtitle blocks.</td></tr>
            <tr><td>Overlap</td><td>Never</td><td>Stops two cues occupying the same time.</td></tr>
            <tr><td>Minimum gap</td><td>Off in Default</td><td>Enforces client-required separation when configured.</td></tr>
          </tbody>
        </table>

        <h2>Rule profiles</h2>
        <p>Open <strong>Tools → Rule profiles…</strong> to choose a built-in profile or create one for a broadcaster, streamer, festival or client. The current preview includes Default, Netflix English and Netflix English for children. Custom profiles control minimum and maximum duration, maximum CPS, line length, line count and a minimum gap in frames or milliseconds.</p>
        <p>The active profile is snapshotted into the project sidecar. If you move the project to another Mac, its limits travel with it even when that custom profile has not been created there.</p>

        <h2>Read the list</h2>
        <p>A start-time warning means overlap or a short gap. A duration warning means the cue is outside the permitted range. A text warning can contain reading-speed, line-length and line-count problems together. Hover or open <strong>View → List errors</strong> for the full reason.</p>

        <h2>Run an error pass</h2>
        <ol class="steps">
          <li><strong>Choose the delivery profile.</strong>Do this before polishing; different clients can produce different warnings.</li>
          <li><strong>Open List errors.</strong>Work in document order or filter your attention by the highlighted column.</li>
          <li><strong>Use next/previous error.</strong><kbd>⌘ ⌥ ↓</kbd> and <kbd>⌘ ⌥ ↑</kbd> keep the correction loop on the keyboard.</li>
          <li><strong>Recheck after bulk tools.</strong>Fixing duration can change reading speed; merging can change both line length and CPS.</li>
        </ol>

        <div class="callout tip"><strong>Untimed script lines are treated differently.</strong><p>Before a timing pass, Substudio checks line length and line count but deliberately skips duration, speed, gap and overlap warnings.</p></div>
      `,
    },

    "spell-check": {
      description:
        "Review spelling with the macOS spell engine while teaching Substudio the people, places and language-specific words in your films.",
      keywords: "spelling spellcheck names dictionary yoruba live underline suggestions",
      html: `
        <h2>Live spell checking</h2>
        <p>Substudio checks subtitle words through the system spell engine and underlines likely misspellings while you edit. Tags, punctuation, timecodes and music-only symbols are ignored. Tokenization keeps Unicode letters and combining marks together, so Yoruba tone marks and dotted letters remain part of the word.</p>

        <h2>Run the review window</h2>
        <p>Choose <strong>Tools → Spell check…</strong>. The dialog walks through issues in cue order, shows the word in context and offers up to eight system suggestions.</p>
        <ul>
          <li><strong>Change</strong> replaces the current occurrence with the edited suggestion.</li>
          <li><strong>Skip</strong> leaves this occurrence and moves on.</li>
          <li><strong>Add to names</strong> records a person, place, company or recurring proper noun.</li>
          <li><strong>Add to dictionary</strong> records an ordinary accepted word.</li>
          <li><strong>Recheck</strong> rebuilds the issue list after edits.</li>
        </ul>

        <h2>Names versus dictionary</h2>
        <p>Both lists stop the word from being reported again. Keeping names separate is useful because film credits, locations and character names grow differently from ordinary language vocabulary. The lists live in Substudio’s local data folder and apply across projects on the same Mac.</p>

        <h2>Working with Yoruba and other marked text</h2>
        <p>Substudio preserves Unicode normalization and does not strip tone marks to make a word look English. A correctly marked name can be added exactly as written. The spell engine available and the suggestions it returns depend on macOS; Substudio’s local names and dictionary lists supplement that engine.</p>

        <div class="callout tip"><strong>Proof after auto-translation.</strong><p>Machine translation can produce valid words in the wrong context, so spelling is only one pass. Review marked machine drafts for meaning before accepting them.</p></div>
      `,
    },

    "bulk-tools": {
      description:
        "Preview and apply repeatable clean-up operations across a document, with each batch kept as an undoable step.",
      keywords:
        "fix common errors beautify timecodes multiple replace casing merge remove hearing impaired cleanup",
      html: `
        <h2>Fix common errors</h2>
        <p>This two-step tool lets you choose fixes, preview the number of changes, then apply them together. Available fixes include:</p>
        <ul>
          <li>push starts to remove overlaps and enforce short gaps;</li>
          <li>collapse double spaces and trim each line;</li>
          <li>remove empty cues;</li>
          <li>optionally add missing sentence periods or normalize dialog dashes;</li>
          <li>repair OCR-style ellipses, split contractions and spaces around italic tags.</li>
        </ul>

        <h2>Beautify time codes</h2>
        <p>Beautify combines frame snapping, minimum-gap enforcement, small-gap bridging and duration limits. Adjust the frame rate and thresholds, then review how many lines would change before applying. It is intended for a finishing pass, not as a substitute for listening to difficult edits.</p>

        <h2>Multiple replace</h2>
        <p>Create named sets of replacements that run in order across every cue. Each rule can match case, whole words or a regular expression and displays its current hit count. Sets are useful for recurring character spellings, house punctuation and terminology corrections.</p>
        <div class="callout warning"><strong>Order matters.</strong><p>Each rule sees the result of the previous one. Put specific replacements before broad patterns and test the hit counts before applying a set.</p></div>

        <h2>Text tools</h2>
        <p>Bulk casing supports lowercase, UPPERCASE, Sentence case and Proper Case. Merge helpers combine adjacent short cues, consecutive cues with identical text, or cues that share the same timecodes.</p>

        <h2>Remove hearing-impaired text</h2>
        <p>Choose which conventions to strip: square brackets, parentheses, music-note text and speaker labels before a colon. Empty cues can be removed at the same time. Use the preview counts and review the result—parentheses and colons can carry ordinary dialogue as well as accessibility information.</p>

        <h2>Undo and quality checks</h2>
        <p>Every bulk tool creates one named history step, so <kbd>⌘ Z</kbd> reverses the batch. Quality checks run on the new cues immediately. After merging or shortening text, reopen List errors to catch new timing and reading-speed problems.</p>
      `,
    },

    translation: {
      description:
        "Create Google machine-translation drafts while preserving source text, then review, edit and explicitly accept every result.",
      keywords:
        "google translate cloud free api key machine translation original review accept yoruba english",
      html: `
        <h2>How Substudio treats machine translation</h2>
        <p>Auto-translate creates a draft, not an approved subtitle. The source stays in the Original column, translated text goes into Text, and each returned cue is marked as machine translated until you edit or accept it. This makes unfinished review work visible after the dialog closes and after the project is reopened.</p>

        <h2>Start a translation pass</h2>
        <ol class="steps">
          <li><strong>Choose Translate → Auto-translate…</strong>Select all lines or only the current multi-selection.</li>
          <li><strong>Choose From and To.</strong>The source can be detected automatically. Yoruba, English, Igbo, Hausa and French are placed first, followed by the full language list.</li>
          <li><strong>Choose an engine.</strong>Use free Google Translate for convenience or Google Cloud Translation with your own API key.</li>
          <li><strong>Review what will leave the Mac.</strong>The dialog states the line count and confirms that only subtitle text is sent—not video, audio or file names.</li>
          <li><strong>Press Translate.</strong>Results appear in the list in batches. You can stop; completed lines remain and a later pass can continue.</li>
        </ol>

        <h2>Where the source goes</h2>
        <p>If the document has no Original column yet, the first successful response copies current Text into Original before writing any translations. If an Original column already exists, Substudio translates from it into Text. A failed first request therefore leaves the document untouched.</p>

        <h2>Choose an engine</h2>
        <table>
          <thead><tr><th>Engine</th><th>Best for</th><th>Trade-off</th></tr></thead>
          <tbody>
            <tr><td>Google Translate</td><td>Quick drafts without account setup</td><td>Uses an unofficial free endpoint that may rate-limit, block unusual traffic or change without notice.</td></tr>
            <tr><td>Google Cloud Translation</td><td>Longer and more reliable production runs</td><td>Requires a Cloud API key and may incur charges from Google.</td></tr>
          </tbody>
        </table>
        <p>The Cloud API key is stored in Substudio’s local settings on this Mac. It is sent only to Google’s Cloud Translation endpoint when that engine is selected.</p>

        <h2>What Substudio does to the text</h2>
        <ul>
          <li>Blank and music-only cues are skipped.</li>
          <li>Ordinary wrapped lines are unbroken before translation so the engine sees the complete sentence.</li>
          <li>Two-speaker dash dialogue remains separated by speaker.</li>
          <li>Whole-line italics are removed for the request and restored afterward.</li>
          <li>Returned text is trimmed, common malformed italic tags are normalized and long text is re-broken using the active line-length limit.</li>
          <li>Batches are limited by line count and characters; free requests pause briefly between batches.</li>
        </ul>

        <h2>Review the drafts</h2>
        <p>Use <strong>Next machine translation</strong> and <strong>Previous machine translation</strong> to move only among unreviewed drafts. Edit a line to clear its machine mark, or press <kbd>⌘ ↩</kbd> to accept it as written and move to the next cue. <strong>Accept all machine translations</strong> clears every remaining mark in one undoable step.</p>

        <h2>Retry, stop and undo</h2>
        <p>If a batch fails, translated lines already received are kept. Fix the key or wait for rate limiting to pass, then Try Again; “keep already translated lines” avoids doing completed work twice. Stopping is similarly non-destructive. After a completed pass, the result toast offers Undo for the whole translation run.</p>

        <div class="callout privacy"><strong>Network boundary</strong><p>Manual editing, waveform generation, spell checking, quality tools and project storage are local. Auto-translate is the exception: only the subtitle strings you choose are sent to Google after you press Translate.</p></div>
      `,
    },

    "original-text": {
      description:
        "Keep source-language dialogue beside the working subtitle, whether it comes from another subtitle, a script or the first translation pass.",
      keywords: "original column bilingual source translation open original paste original sidecar",
      html: `
        <h2>The two-column model</h2>
        <p>Substudio uses <strong>Original</strong> for source-language text and <strong>Text</strong> for the working or delivered subtitle. Timing belongs to the cue, so both strings stay attached to the same start and end.</p>

        <h2>Open an original subtitle</h2>
        <p>Choose <strong>File → Open original…</strong> to load a second subtitle as source text. Substudio aligns its lines to the current document and displays the Original column. <strong>Close original</strong> removes the working source column without deleting the main subtitle file.</p>

        <h2>Paste original lines</h2>
        <p>Copy one source line per line to the clipboard, select the destination cue and choose <strong>Edit → Paste original lines</strong>. This supports scripts from a document or spreadsheet without replacing the translation column.</p>

        <h2>Auto-translate seeding</h2>
        <p>When a document has no originals, the first successful auto-translation pass copies current Text into Original, then writes drafts into Text. That one-time seed keeps the source visible and makes retries translate from the same stable wording.</p>

        <h2>Visibility and persistence</h2>
        <p>Toggle the Original column from <strong>View → Columns → Original</strong>. Original strings and machine-review marks are stored in the project sidecar because SRT and several other delivery formats have no standard second-text field. Exported subtitle text remains the Text column unless a format-specific tool says otherwise.</p>

        <div class="callout tip"><strong>Keep source changes deliberate.</strong><p>If the source script changes after translation has begun, update Original first and retranslate only the affected selection. This avoids replacing reviewed work elsewhere in the film.</p></div>
      `,
    },

    "video-delivery": {
      description:
        "Create a video with permanent burned subtitles or add a selectable subtitle track without overwriting the source film.",
      keywords: "burn in hardcode embed mux soft subtitles mp4 mov mkv ffmpeg delivery",
      html: `
        <h2>Burn-in versus embedding</h2>
        <table>
          <thead><tr><th>Method</th><th>Result</th><th>Use when</th></tr></thead>
          <tbody>
            <tr><td>Burn subtitles into video</td><td>Text becomes part of every video frame and cannot be turned off.</td><td>Social uploads, review copies and platforms that do not accept a subtitle track.</td></tr>
            <tr><td>Embed subtitles into video</td><td>Adds a selectable soft-subtitle track to MP4, MOV or MKV.</td><td>Players and deliverables that support optional captions or multiple languages.</td></tr>
          </tbody>
        </table>

        <h2>Burn subtitles into video</h2>
        <ol class="steps">
          <li><strong>Open the source video and final subtitle.</strong>Save the subtitle first.</li>
          <li><strong>Choose File → Burn subtitles into video…</strong>Select the full document or the tool’s offered range.</li>
          <li><strong>Choose the output.</strong>Burn-in creates MP4 and suggests a name ending in <code>.burned.mp4</code>.</li>
          <li><strong>Watch the progress.</strong>You can cancel without touching the source file.</li>
          <li><strong>Review the rendered file.</strong>Check the first, middle and last cues, italics, line breaks, picture aspect and audio.</li>
        </ol>

        <h2>Embed a subtitle track</h2>
        <p>Choose <strong>File → Embed subtitles into video…</strong>. Substudio keeps MP4, MOV or MKV when the source container supports the operation, otherwise it proposes MP4. Output names end in <code>.subs</code> before the extension and never target the source path.</p>
        <ul>
          <li>MP4/MOV use a compatible mov_text subtitle track.</li>
          <li>MKV can carry SRT text or preserve ASS styling where supported.</li>
          <li>Video streams are copied when the container allows it; incompatible audio is converted rather than making an invalid file.</li>
        </ul>

        <div class="callout warning"><strong>Always test the delivery player.</strong><p>Soft subtitle support varies by television, browser and review platform. A valid track can still be ignored or restyled. Burn-in is less flexible but more predictable.</p></div>
      `,
    },

    "projects-recovery": {
      description:
        "Understand sidecar projects, undo history, automatic saves, backups and recovery after an external file change.",
      keywords: "autosave backup restore recovery crash sidecar history undo recent external changes",
      html: `
        <h2>Subtitle file and project sidecar</h2>
        <p>Your SRT, VTT or other subtitle file is the deliverable. A neighbouring <code>.substudio.json</code> sidecar stores editor state that does not belong in that format: video association, audio track, frame information, bookmarks, selection, shot changes, rule profile, source text and machine-translation marks.</p>
        <p>Sidecars are optional and defensive. Missing, outdated or corrupt sidecars are ignored rather than preventing the subtitle from opening.</p>

        <h2>Undo and redo</h2>
        <p>Use <kbd>⌘ Z</kbd> and <kbd>⌘ ⇧ Z</kbd> for normal undo and redo. Related edits share history keys where appropriate, so typing does not create an unusably noisy history and bulk operations remain a single reversible step. <strong>Show history…</strong> exposes the named sequence.</p>

        <h2>Automatic safety saves</h2>
        <p>While a document has unsaved changes, Substudio periodically writes a recovery copy to its application data folder. If the subtitle already has a path, the safety cycle also writes the current subtitle and sidecar to their normal locations. The number of retained recovery copies follows the local backup setting.</p>

        <h2>Restore a backup</h2>
        <ol class="steps">
          <li><strong>Choose File → Restore auto-backup…</strong>The newest recovery copies appear first.</li>
          <li><strong>Select by time and source name.</strong>Open the candidate as an unsaved document.</li>
          <li><strong>Inspect before saving.</strong>Restoring does not silently overwrite the original path.</li>
          <li><strong>Save As when satisfied.</strong>Choose the old path to replace it or a new path to keep both.</li>
        </ol>

        <h2>External file changes</h2>
        <p>Substudio records the known modification time. If another editor, sync tool or script changes the open subtitle, the app asks whether to reload. Declining updates the known timestamp so the same external change does not interrupt you repeatedly.</p>

        <h2>Moving a project</h2>
        <p>Move the subtitle, sidecar and video together when possible. If the remembered absolute video path no longer exists, Substudio looks for the video by name near the subtitle. Cached waveforms and proxies can be regenerated.</p>
      `,
    },

    customization: {
      description:
        "Adapt the workspace with themes, row density, preview styling, visible columns, timecode display and editable shortcuts.",
      keywords:
        "settings appearance dark light theme density columns preview shortcuts subtitle edit preset privacy",
      html: `
        <h2>Theme and density</h2>
        <p>Choose Match System, Light or Dark from the View menu. Compact rows fit more of a long film on screen; Comfortable rows leave more breathing room for touchpads and visual review.</p>

        <h2>Columns and time display</h2>
        <p>Toggle CPS, Gap and Original columns independently. Timecodes can display frame numbers or milliseconds without changing the underlying cue times. Formatting in the grid can be rendered or shown as literal tags depending on what you need to inspect.</p>

        <h2>Subtitle preview</h2>
        <p>Choose a background box or outline, step through four preview sizes and move the subtitle from low to top positions. These settings affect the editor preview. Delivery rendering and soft-track player styles can still differ.</p>

        <h2>Keyboard shortcuts</h2>
        <p>Open <strong>Tools → Keyboard shortcuts…</strong> to search commands, capture a new key combination, remove a binding or reset overrides. Duplicate assignments are shown before they become confusing. Substudio’s registry keeps the menu, command palette and shortcut editor pointed at the same action.</p>
        <p>The default set is designed for macOS and keeps ordinary text-editing keys available while the text box has focus. Commands marked “outside text” fire only when you are navigating the app, while playback function keys remain global so you can listen while typing.</p>

        <h2>Screen privacy</h2>
        <p>Press <kbd>⌘ ⇧ P</kbd> to cycle privacy modes when sharing your screen. The first mode hides project and media names; the stronger mode also obscures subtitle text. The files themselves are unchanged.</p>

        <div class="cards">
          <a class="card" href="?page=shortcuts"><strong>Shortcut reference</strong><span>See the default keys grouped by editing task.</span></a>
          <a class="card" href="?page=privacy"><strong>Privacy reference</strong><span>Understand what stays local and what uses the network.</span></a>
        </div>
      `,
    },
  });

  Object.assign(pages, {
    "tutorial-create": {
      description:
        "A complete workflow for turning a film—or a prepared dialogue script—into a timed, checked subtitle file.",
      keywords: "tutorial create from scratch transcription script import timing workflow",
      html: `
        <h2>Before you begin</h2>
        <p>Prepare the final or near-final picture, decide the delivery frame rate and ask for any available dialogue script. Timing against a locked picture avoids repeating work after an edit changes.</p>

        <h2>1. Open the film</h2>
        <p>Choose <strong>File → Open video…</strong>. Wait for media probing and waveform generation, then confirm the correct audio track. Open Media Information if the source has an unusual start offset or variable frame rate.</p>

        <h2>2. Choose a starting method</h2>
        <h3>With a prepared script</h3>
        <p>Choose <strong>File → Import plain text…</strong>. Put one intended subtitle unit on each non-empty line. The imported rows are untimed, so you can work down the list while listening.</p>
        <h3>Without a script</h3>
        <p>Create cues from selected waveform regions, use Add subtitle at playhead, or hold <kbd>H</kbd> for the spoken duration. Type the dialogue after each cue or make a quick timing pass first and fill text on a second pass.</p>

        <h2>3. Establish your working loop</h2>
        <ol class="steps">
          <li><strong>Play the current line.</strong><kbd>F5</kbd> plays its exact range; <kbd>F6</kbd> adds context before it.</li>
          <li><strong>Set or correct the bounds.</strong>Use the waveform for visual placement and frame keys for the final edge.</li>
          <li><strong>Type and break the text.</strong>Use Auto-break, Balance lines and dialog dashes instead of manual spaces.</li>
          <li><strong>Advance and play.</strong><kbd>⌘ ⇧ ↩</kbd> selects the next cue and starts it.</li>
        </ol>

        <h2>4. Use quality feedback while working</h2>
        <p>Select the intended delivery profile early. If a cue becomes too fast, shorten the wording or extend the duration where the edit allows. If a line is too long, re-break or split the cue at a natural phrase and audio boundary. Do not wait until line 1,100 to discover the client’s limits.</p>

        <h2>5. Handle scene boundaries</h2>
        <p>Generate shot changes if picture cuts matter to the delivery. Avoid leaving a subtitle across an unrelated cut unless the client style permits it. Snap only when the detector’s marker matches the actual edit.</p>

        <h2>6. Save and review</h2>
        <p>Save the subtitle early to establish its path and project sidecar. At the end, play through at normal speed, then run List errors, spell check and the final quality tutorial. Export the requested format only after the working file passes review.</p>

        <div class="callout tip"><strong>For long films, separate passes beat constant context-switching.</strong><p>A rough timing pass, text pass and focused quality pass are often faster than perfecting every cue before moving to the next—especially when source dialogue needs clarification.</p></div>
      `,
    },

    "tutorial-translate": {
      description:
        "Translate a feature-length subtitle while keeping the source visible and machine-generated drafts clearly separated from approved work.",
      keywords: "tutorial translation workflow whole film machine review original column",
      html: `
        <h2>Choose your source</h2>
        <p>Open a timed source subtitle as the main document, or open an existing translation and load the source with <strong>File → Open original…</strong>. Confirm that source and translation cues align before translating; machine output cannot repair mismatched timing or line order.</p>

        <h2>Set up the two columns</h2>
        <p>If you begin with source text in the Text column, Auto-translate will seed Original after the first successful response. If you prefer a fully manual workflow, load or paste Original and leave Text empty. Toggle the Original column on so both remain visible during review.</p>

        <h2>Create drafts in manageable sections</h2>
        <ol class="steps">
          <li><strong>Select a scene or translate all.</strong>For a first production run, scene-sized selections make review and rate limits easier to manage.</li>
          <li><strong>Choose source and target.</strong>Automatic source detection is convenient; an explicit source is more predictable when a film switches languages.</li>
          <li><strong>Choose Google free or Cloud.</strong>Use Cloud for reliable long runs; use free translation knowing it may stop temporarily.</li>
          <li><strong>Start and watch the first batch.</strong>Confirm names, register, dialog formatting and line breaks before continuing through the film.</li>
        </ol>

        <h2>Review rather than merely read</h2>
        <p>Start at the first marked machine translation. Listen to the scene, compare Original with Text and check meaning, tone, names, pronouns, idioms and continuity. Editing clears the machine marker. If the draft is already acceptable, press <kbd>⌘ ↩</kbd> to accept and advance.</p>

        <h2>Handle culture and context</h2>
        <p>For proverbs, humour, honorifics and code-switching, translate the dramatic intent rather than individual words. Use a bookmark note when you need a director, translator or cultural consultant to decide. A fluent-looking sentence can still be the wrong subtitle.</p>

        <h2>Keep the delivery readable</h2>
        <p>Machine output is re-broken to the line limit, but reading speed and natural segmentation still require judgment. Shorten repetitions that are natural in speech but heavy on screen. Split only where timing and syntax both permit it.</p>

        <h2>Finish the review</h2>
        <p>Use Next machine translation until Substudio reports that none remain. Run spell check on the target language, search for recurring names and use List errors for timing. Accept All is appropriate only after a separate review process has already approved every remaining marked line.</p>

        <div class="callout privacy"><strong>Consent stays per pass.</strong><p>Nothing is sent while you edit or review. Subtitle strings leave the Mac only after you open Auto-translate, see the scope and press Translate.</p></div>
      `,
    },

    "tutorial-resync": {
      description:
        "Identify whether subtitles have a fixed offset or progressive drift, then repair the track with the smallest correct transformation.",
      keywords: "tutorial resync offset drift visual sync frame rate speed",
      html: `
        <h2>Measure three points</h2>
        <p>Check a clear line near the beginning, middle and end. Write down whether the subtitle is early or late and by roughly how much.</p>
        <table>
          <thead><tr><th>Pattern</th><th>Likely cause</th><th>Tool</th></tr></thead>
          <tbody>
            <tr><td>Same error everywhere</td><td>Added or removed lead-in</td><td>Adjust times by offset</td></tr>
            <tr><td>Error grows smoothly</td><td>Different edit length or clock rate</td><td>Visual sync</td></tr>
            <tr><td>Known 23.976/24/25 relationship</td><td>Frame-rate or PAL speed conversion</td><td>Change frame rate or Change speed</td></tr>
            <tr><td>Correct, then suddenly wrong</td><td>Inserted or removed scene</td><td>Shift selected and following at the edit</td></tr>
          </tbody>
        </table>

        <h2>Fixed offset</h2>
        <p>Select all cues, open Adjust Times and enter the measured correction. A subtitle 1.2 seconds late needs a negative 1.2-second shift; one that appears too early needs a positive shift. Preview the first cue and make sure no cue would move before zero.</p>

        <h2>Progressive drift</h2>
        <p>Open Visual Sync. Choose an early subtitle with a clear sound or picture event and set its correct video time. Repeat with a late event. Apply the linear mapping, then verify an independent point around the middle. If the middle is wrong, the track may contain an edit rather than uniform drift.</p>

        <h2>A single edit difference</h2>
        <p>Find the first cue after the inserted or removed material. Select it and all following cues, then shift that block until it aligns again. Leave earlier cues untouched. Repeat only if there are multiple structural edits.</p>

        <h2>Finish at frame precision</h2>
        <p>After the broad correction, snap all times to frames if required and inspect cues around cuts. Run List errors because scaling can create short durations, overlaps or insufficient gaps even when dialogue alignment is correct.</p>

        <div class="callout warning"><strong>Do not guess frame-rate conversion from drift alone.</strong><p>A recut film can mimic a rate problem. Use Media Information and known source history before choosing a global speed transformation.</p></div>
      `,
    },

    "tutorial-quality": {
      description:
        "A repeatable finishing pass for timing, readability, spelling, consistency and delivery safety.",
      keywords: "tutorial qc final review checklist errors spell check consistency delivery",
      html: `
        <h2>1. Lock the rules</h2>
        <p>Select the client’s rule profile and confirm the frame rate. If no client limits exist, start with Default and record any project-specific decisions in your handoff notes.</p>

        <h2>2. Run structural clean-up</h2>
        <p>Remove blank cues, normalize obvious double spaces and fix malformed italic spacing. Preview Fix Common Errors rather than enabling punctuation changes blindly. Run Beautify only when its gap and duration behavior match the delivery specification.</p>

        <h2>3. Clear the error list</h2>
        <ol class="steps">
          <li><strong>Fix overlaps and gaps.</strong>These affect downstream timing and should come first.</li>
          <li><strong>Fix duration and reading speed.</strong>Extend where sound and cuts allow; otherwise edit the text.</li>
          <li><strong>Fix line length and line count.</strong>Re-break, rebalance or split at a natural phrase.</li>
          <li><strong>Repeat the list.</strong>Each correction can expose another rule.</li>
        </ol>

        <h2>4. Check language</h2>
        <p>Run spell check, then search for every recurring character and place name. Use Multiple Replace only after verifying the intended forms. Search for repeated punctuation, double hyphens, straight/curly quote inconsistencies and common transcription habits relevant to the project.</p>

        <h2>5. Review original and translation</h2>
        <p>If the project has an Original column, scan for empty target cues, unchanged source copied into Text and unresolved machine markers. Navigate machine translations until none remain.</p>

        <h2>6. Watch the programme</h2>
        <p>Automated checks cannot judge context. Play at normal speed and watch for subtitles that arrive before a reveal, cover important picture, remain across a scene change, identify the wrong speaker or translate something contradicted later.</p>

        <h2>7. Export and reopen</h2>
        <p>Export the actual delivery format, reopen that file and spot-check it. This catches format limitations and serialization mistakes that are invisible in the working document. For video delivery, inspect the rendered or muxed output in the intended player.</p>

        <div class="callout tip"><strong>Use Statistics as a sense-check.</strong><p>Totals, duration and reading-speed summaries can reveal an accidentally missing reel, an abnormally dense section or a selection-only operation applied to the wrong scope.</p></div>
      `,
    },

    "tutorial-deliver": {
      description:
        "Choose the right subtitle or video deliverable, export it safely and perform a final playback check.",
      keywords: "tutorial export srt vtt ass ttml youtube burn embed deliver",
      html: `
        <h2>Ask what the recipient needs</h2>
        <p>“Subtitles” can mean an editable text file, a selectable track inside a video or text permanently burned into picture. Confirm the format, frame rate, language code, naming convention and whether styling must survive.</p>

        <h2>Deliver a subtitle file</h2>
        <ul>
          <li><strong>SRT</strong> for the broadest compatibility and simple italic text.</li>
          <li><strong>WebVTT</strong> for web players and browser-based video.</li>
          <li><strong>ASS/SSA</strong> when the recipient supports style definitions and positioning.</li>
          <li><strong>SBV</strong> for workflows that specifically request YouTube’s simple text format.</li>
          <li><strong>TTML/DFXP</strong> for XML-based broadcast, platform or interchange workflows.</li>
        </ul>
        <p>Use Save As or the named export command, then reopen the exported file in Substudio. Confirm line count, first and last times, italics and non-ASCII characters.</p>

        <h2>Deliver a selectable track</h2>
        <p>Embed into MP4/MOV/MKV when the recipient wants one media file but viewers must be able to turn subtitles off. Check the track in the exact player or platform being used; styling support is player-dependent.</p>

        <h2>Deliver permanent subtitles</h2>
        <p>Burn into MP4 when the text must appear everywhere. Review resolution, aspect ratio, subtitle size and placement, audio sync and the entire encoding range. Keep the clean source video because burned text cannot be removed reliably.</p>

        <h2>Name and package the files</h2>
        <p>Use unambiguous names such as <code>FilmTitle.en-GB.srt</code>, <code>FilmTitle.yo.srt</code> and <code>FilmTitle.review-burned.mp4</code>. Include a short handoff note with format, frame rate, runtime, language, rule profile and any unresolved choices.</p>

        <h2>Keep your editable project</h2>
        <p>Archive the subtitle, project sidecar and source information separately from generated video deliverables. A later text correction is quick from the source project and expensive from a burned-only master.</p>
      `,
    },

    shortcuts: {
      description:
        "Default macOS shortcuts for the actions that matter most during a long subtitle editing session.",
      keywords: "keyboard hotkeys keys command reference shortcuts f5 f10 subtitle edit",
      html: `
        <div class="callout tip"><strong>Shortcuts are editable.</strong><p>Open <strong>Tools → Keyboard shortcuts…</strong> to search the complete command list, change bindings or reset to defaults. “⌘” below means Command on macOS.</p></div>

        <h2>Files and history</h2>
        <table><thead><tr><th>Action</th><th>Shortcut</th></tr></thead><tbody>
          <tr><td>New</td><td><kbd>⌘ N</kbd></td></tr><tr><td>Open subtitles</td><td><kbd>⌘ O</kbd></td></tr>
          <tr><td>Open video</td><td><kbd>⌘ ⇧ O</kbd></td></tr><tr><td>Save</td><td><kbd>⌘ S</kbd></td></tr>
          <tr><td>Save As</td><td><kbd>⌘ ⇧ S</kbd></td></tr><tr><td>Undo / redo</td><td><kbd>⌘ Z</kbd> / <kbd>⌘ ⇧ Z</kbd></td></tr>
        </tbody></table>

        <h2>Navigation and search</h2>
        <table><thead><tr><th>Action</th><th>Shortcut</th></tr></thead><tbody>
          <tr><td>Previous / next cue</td><td><kbd>↑</kbd> / <kbd>↓</kbd></td></tr><tr><td>Edit selected text</td><td><kbd>Enter</kbd></td></tr>
          <tr><td>Find</td><td><kbd>⌘ F</kbd> or <kbd>⌘ K</kbd></td></tr><tr><td>Replace</td><td><kbd>⌘ ⌥ F</kbd></td></tr>
          <tr><td>Next / previous match</td><td><kbd>⌘ G</kbd> / <kbd>⌘ ⇧ G</kbd></td></tr><tr><td>Go to line</td><td><kbd>⌘ L</kbd></td></tr>
          <tr><td>Next / previous error</td><td><kbd>⌘ ⌥ ↓</kbd> / <kbd>⌘ ⌥ ↑</kbd></td></tr><tr><td>Command palette</td><td><kbd>⌘ ⇧ K</kbd></td></tr>
          <tr><td>Focus list / text / waveform</td><td><kbd>⌘ 1</kbd> / <kbd>⌘ 2</kbd> / <kbd>⌘ 3</kbd></td></tr>
        </tbody></table>

        <h2>Text and lines</h2>
        <table><thead><tr><th>Action</th><th>Shortcut</th></tr></thead><tbody>
          <tr><td>Italic</td><td><kbd>⌘ I</kbd></td></tr><tr><td>Auto-break / unbreak</td><td><kbd>⌘ R</kbd> / <kbd>⌘ ⇧ R</kbd></td></tr>
          <tr><td>Toggle line break</td><td><kbd>⌘ ⇧ L</kbd></td></tr><tr><td>Dialog dashes</td><td><kbd>⌘ ⇧ D</kbd></td></tr>
          <tr><td>Split at cursor / video</td><td><kbd>⌘ T</kbd> / <kbd>⌘ ⇧ T</kbd></td></tr><tr><td>Duplicate lines</td><td><kbd>⌘ D</kbd></td></tr>
          <tr><td>Merge previous / next</td><td><kbd>⌘ ⇧ ←</kbd> / <kbd>⌘ ⇧ →</kbd></td></tr><tr><td>Merge selected</td><td><kbd>⌘ ⇧ M</kbd></td></tr>
          <tr><td>Move text after cursor to next</td><td><kbd>⌘ ⌥ T</kbd></td></tr><tr><td>…and play</td><td><kbd>⌘ ⌥ ⇧ T</kbd></td></tr>
        </tbody></table>

        <h2>Playback</h2>
        <table><thead><tr><th>Action</th><th>Shortcut</th></tr></thead><tbody>
          <tr><td>Play / pause</td><td><kbd>Space</kbd></td></tr><tr><td>Play / loop selected</td><td><kbd>F5</kbd> / <kbd>⇧ F5</kbd></td></tr>
          <tr><td>Play before selected</td><td><kbd>F6</kbd></td></tr><tr><td>Play previous / next</td><td><kbd>F7</kbd> / <kbd>F8</kbd></td></tr>
          <tr><td>Loop previous / next</td><td><kbd>⇧ F7</kbd> / <kbd>⇧ F8</kbd></td></tr><tr><td>Next and play</td><td><kbd>⌘ ⇧ ↩</kbd></td></tr>
          <tr><td>Step one frame</td><td><kbd>←</kbd> / <kbd>→</kbd></td></tr><tr><td>Step 100 ms</td><td><kbd>⇧ ←</kbd> / <kbd>⇧ →</kbd></td></tr>
          <tr><td>Step 500 ms</td><td><kbd>⌘ ←</kbd> / <kbd>⌘ →</kbd></td></tr><tr><td>Step 1 second</td><td><kbd>⌃ ⇧ ←</kbd> / <kbd>⌃ ⇧ →</kbd></td></tr>
        </tbody></table>

        <h2>Timing</h2>
        <table><thead><tr><th>Action</th><th>Shortcut</th></tr></thead><tbody>
          <tr><td>Hold to time</td><td><kbd>H</kbd></td></tr><tr><td>Set start / end</td><td><kbd>F11</kbd> / <kbd>F12</kbd></td></tr>
          <tr><td>Set end and next</td><td><kbd>F10</kbd></td></tr><tr><td>Set start, offset rest</td><td><kbd>F9</kbd></td></tr>
          <tr><td>Set end, add and go</td><td><kbd>⇧ F10</kbd></td></tr><tr><td>Nudge start one frame</td><td><kbd>⌥ ←</kbd> / <kbd>⌥ →</kbd></td></tr>
          <tr><td>Nudge end one frame</td><td><kbd>⌥ ⇧ ←</kbd> / <kbd>⌥ ⇧ →</kbd></td></tr><tr><td>Move selected one frame</td><td><kbd>⌥ ⌘ ←</kbd> / <kbd>⌥ ⌘ →</kbd></td></tr>
        </tbody></table>

        <h2>Bookmarks, translation and privacy</h2>
        <table><thead><tr><th>Action</th><th>Shortcut</th></tr></thead><tbody>
          <tr><td>Toggle bookmark</td><td><kbd>⌘ B</kbd></td></tr><tr><td>Edit bookmark note</td><td><kbd>⌘ ⇧ B</kbd></td></tr>
          <tr><td>Next / previous bookmark</td><td><kbd>⌘ ⌥ B</kbd> / <kbd>⌘ ⌥ ⇧ B</kbd></td></tr><tr><td>Accept translation and next</td><td><kbd>⌘ ↩</kbd></td></tr>
          <tr><td>Screen privacy</td><td><kbd>⌘ ⇧ P</kbd></td></tr>
        </tbody></table>
      `,
    },

    formats: {
      description: "The subtitle, video and text formats Substudio currently reads, writes and delivers.",
      keywords: "format support matrix srt webvtt ass ssa sbv ttml dfxp mp4 mov mkv",
      html: `
        <h2>Subtitle formats</h2>
        <table>
          <thead><tr><th>Format</th><th>Open</th><th>Save/export</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>SubRip (.srt)</td><td>Yes</td><td>Yes</td><td>Primary compatibility format; millisecond timing and basic inline tags.</td></tr>
            <tr><td>WebVTT (.vtt)</td><td>Yes</td><td>Yes</td><td>Web timing syntax; basic cue text is preserved.</td></tr>
            <tr><td>ASS (.ass)</td><td>Yes</td><td>Yes</td><td>Reads and writes dialogue and core style definitions.</td></tr>
            <tr><td>SSA (.ssa)</td><td>Yes</td><td>Yes</td><td>Legacy Sub Station Alpha variant with style/dialogue support.</td></tr>
            <tr><td>YouTube SBV (.sbv)</td><td>Yes</td><td>Yes</td><td>Simple YouTube text timing format.</td></tr>
            <tr><td>TTML (.ttml)</td><td>Yes</td><td>Yes</td><td>XML timed text with clock and offset time parsing.</td></tr>
            <tr><td>DFXP (.dfxp)</td><td>Yes</td><td>Yes</td><td>Uses the TTML reader/writer with the DFXP extension.</td></tr>
            <tr><td>Plain text (.txt)</td><td>Import</td><td>Custom export</td><td>One non-empty line per untimed cue; custom templates for output.</td></tr>
          </tbody>
        </table>

        <h2>What may not transfer</h2>
        <p>Bookmarks, selected audio track, shot changes, machine-review marks and Original text live in the project sidecar. Simple formats such as SRT cannot store them. Advanced ASS styling can also be reduced when exporting to a simpler format. Always reopen the target format before delivery.</p>

        <h2>Video inputs and playback</h2>
        <p>The drop workflow recognizes MP4, MOV, M4V and WebM directly. The desktop file picker and media layer can handle additional files supported by the packaged probing and conversion tools. Unsupported playback sources can use a local proxy.</p>

        <h2>Video outputs</h2>
        <table>
          <thead><tr><th>Operation</th><th>Output</th></tr></thead>
          <tbody>
            <tr><td>Burn-in</td><td>MP4 with subtitles rendered permanently into picture</td></tr>
            <tr><td>Embed</td><td>MP4, MOV or MKV with a selectable subtitle track</td></tr>
          </tbody>
        </table>

        <h2>Encoding</h2>
        <p>Substudio writes Unicode text so Yoruba and other non-ASCII scripts remain intact. Open handles UTF-8, BOMs and common Windows-1252 input; use Import with Encoding when a legacy file needs an explicit decoder.</p>
      `,
    },

    privacy: {
      description:
        "A precise account of what stays on your Mac, what is stored locally and when subtitle text is sent to Google.",
      keywords: "privacy local network google api key unreleased films screen sharing data",
      html: `
        <h2>Local by default</h2>
        <p>Opening, editing, playing, waveform generation, spectrogram generation, project persistence, quality checks, spell-check orchestration, backups, format conversion, shot detection, burn-in and embedding happen on your Mac. Substudio does not upload the film for these workflows.</p>

        <h2>Auto-translation is the explicit exception</h2>
        <p>When you press Translate, Substudio sends the selected subtitle strings to the chosen Google translation endpoint. It does not include video, audio, file names, project paths, bookmarks or the project sidecar.</p>
        <table>
          <thead><tr><th>Engine</th><th>Destination</th><th>Credential</th></tr></thead>
          <tbody>
            <tr><td>Google Translate (free)</td><td>Google’s translation service endpoints</td><td>No user key; unofficial service behavior</td></tr>
            <tr><td>Google Cloud Translation</td><td>Google Cloud Translation API</td><td>Your API key, stored in local app settings</td></tr>
          </tbody>
        </table>
        <p>Google’s own terms and privacy practices govern text received by its services. Do not use machine translation for material whose agreements forbid third-party processing.</p>

        <h2>Local data</h2>
        <ul>
          <li>Settings include appearance, recent paths, shortcut overrides, custom rules, replacement sets and translation preferences.</li>
          <li>Sidecar projects sit beside subtitles and can contain source text and workflow metadata.</li>
          <li>Backups, names, dictionary words, waveform caches and proxy files live in Substudio’s local data locations.</li>
        </ul>
        <p>Choose <strong>File → Open data folder</strong> to inspect local application data.</p>

        <h2>Screen privacy</h2>
        <p>Screen Privacy hides names first and subtitle text in the stronger mode. It is for calls, demonstrations and screenshots; it does not encrypt files or change what another account on the Mac can access.</p>

        <div class="callout privacy"><strong>Working on an unreleased film?</strong><p>Keep the project on approved storage, use Screen Privacy during calls and confirm contractual permission before sending any dialogue to a cloud translation service.</p></div>
      `,
    },

    faq: {
      description:
        "Answers to common questions about installation, files, timing, translation, recovery and delivery.",
      keywords: "frequently asked questions troubleshooting help",
      html: `
        <h2>Why will macOS not open Substudio?</h2>
        <p>The current preview is not notarised. Follow the <a href="?page=install">first-launch steps</a> in Privacy &amp; Security, or remove the quarantine flag in Terminal after copying the app to Applications.</p>

        <h2>Does Substudio upload my film?</h2>
        <p>No. Media processing is local. Auto-translate sends only the subtitle text in the scope you confirm. See <a href="?page=privacy">Privacy and network use</a>.</p>

        <h2>Where did the Original column come from?</h2>
        <p>You opened or pasted source text, or Auto-translate seeded it from the current Text column. Toggle its visibility under View → Columns. It is stored in the project sidecar rather than ordinary SRT output.</p>

        <h2>Why are cells red or highlighted?</h2>
        <p>The cue violates the active rule profile: overlap, short gap, duration, reading speed, line length or line count. Open List errors for the exact reason.</p>

        <h2>Why is the free translation engine blocked?</h2>
        <p>Google may rate-limit or return an “unusual traffic” page. Wait and retry, translate a smaller selection, change networks only if your policy allows it, or use a Google Cloud Translation API key.</p>

        <h2>Can I stop translation halfway?</h2>
        <p>Yes. Completed batches remain in the document and stay marked for review. A later pass with “keep lines that already have a translation” continues with unfinished cues.</p>

        <h2>My video drifts out of sync. What should I use?</h2>
        <p>Check beginning, middle and end. A constant error needs Adjust Times; smooth drift needs Visual Sync or a verified rate conversion; a sudden change needs Selected and Following from the edit point.</p>

        <h2>Can I recover work after a crash or mistake?</h2>
        <p>Try Undo/Show History first. For an earlier safety copy, use File → Restore auto-backup. Restored backups open unsaved so you can inspect before replacing anything.</p>

        <h2>Why did styling change after export?</h2>
        <p>The target format may not support the source format’s styling. SRT is intentionally simple. Keep an ASS/SSA master when style definitions matter, and test the actual delivery player.</p>

        <h2>Should I burn in or embed subtitles?</h2>
        <p>Burn-in is permanent and universally visible. Embedding keeps a selectable track but depends on player support. Deliver a separate subtitle file when the platform accepts one and future edits matter.</p>

        <h2>How do I report a problem?</h2>
        <p>Open an issue in the <a href="https://github.com/aramidefemi/substudio/issues">Substudio repository</a>. Include the app version, macOS version, the smallest safe sample or exact steps, what you expected and what happened. Do not attach confidential film material to a public issue.</p>
      `,
    },
  });

  window.SUBSTUDIO_DOCS = { nav, pages };
})();
