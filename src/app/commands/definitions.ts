import { AUDIO_TRACK_COMMANDS } from "@/features/playback/audioCommands";
import { clock } from "@/features/playback/clock";
import {
  changeSpeed,
  goToNextAndPlay,
  holdToTimeEnd,
  holdToTimeStart,
  jump,
  playBeforeSelection,
  playNeighbour,
  playSelection,
  resetSpeed,
  stepFrame,
  toggleLoopSelection,
} from "@/features/playback/transport";
import { setDensity, setPreview, setTheme, stepPreviewPosition, stepPreviewSize } from "@/features/settings/store";
import { selectRelative, toggleTimecode } from "@/features/subtitles/store";
import type { NudgeMode } from "@/features/subtitles/timing";
import type { TimingStep } from "@/features/subtitles/store";
import { enterOutsideText, WAVEFORM_COMMANDS } from "@/features/waveform/commands";
import { focusCueText, focusSubtitleList, focusWaveform } from "@/lib/dom";
import * as a from "../actions";
import * as fr from "../findReplace";
import { openGoToLine } from "../goToLine";
import { openRuleProfiles } from "../ruleProfiles";
import { openAdjustTimes, openChangeFrameRate, openChangeSpeed } from "../retimeUi";
import { openVisualSync } from "../syncUi";
import { defineCommands, type Command } from "./registry";

type Dir = 1 | -1;
const sign = (d: Dir) => (d < 0 ? "−" : "+");
const STEP_LABEL: Record<TimingStep, string> = { frame: "1 frame", ms: "100 ms", custom: "custom ms" };
const STEP_KEY: Record<TimingStep, string> = { frame: "frame", ms: "ms", custom: "custom" };
const dirKey = (d: Dir) => (d < 0 ? "-" : "+");

/** Move start/end variants: one id per step, direction and mode (SE parity). */
function edgeCommands(edge: "start" | "end"): Command[] {
  const run = edge === "start" ? a.timingMoveStart : a.timingMoveEnd;
  const name = edge === "start" ? "Move start" : "Move end";
  const base = edge === "start" ? "timing.moveStart" : "timing.moveEnd";
  const out: Command[] = [];
  for (const step of ["frame", "ms", "custom"] as TimingStep[]) {
    for (const d of [-1, 1] as Dir[]) {
      const keys =
        step === "frame"
          ? [edge === "start" ? `Alt+Arrow${d < 0 ? "Left" : "Right"}` : `Alt+Shift+Arrow${d < 0 ? "Left" : "Right"}`]
          : undefined;
      out.push({
        id: `${base}.${STEP_KEY[step]}.${dirKey(d)}`,
        label: `${name} ${sign(d)}${STEP_LABEL[step]}`,
        group: "Timing",
        keys,
        scope: "outsideText",
        run: () => run(step, d),
      });
    }
  }
  for (const mode of ["keepGap", "push"] as NudgeMode[]) {
    for (const d of [-1, 1] as Dir[]) {
      out.push({
        id: `${base}.${mode}.frame.${dirKey(d)}`,
        label: `${name} ${sign(d)}1 frame (${mode === "keepGap" ? "keep gap" : "push"})`,
        group: "Timing",
        run: () => run("frame", d, mode),
      });
    }
  }
  return out;
}

function shiftCommands(): Command[] {
  const out: Command[] = [];
  for (const step of ["frame", "ms", "custom"] as TimingStep[]) {
    for (const d of [-1, 1] as Dir[]) {
      out.push({
        id: `timing.moveSelected.${STEP_KEY[step]}.${dirKey(d)}`,
        label: `Move selected ${sign(d)}${STEP_LABEL[step]}`,
        group: "Timing",
        keys: step === "frame" ? [`Alt+$mod+Arrow${d < 0 ? "Left" : "Right"}`] : undefined,
        scope: "outsideText",
        run: () => a.timingMoveSelected(step, d),
      });
      out.push({
        id: `timing.moveAll.${STEP_KEY[step]}.${dirKey(d)}`,
        label: `Move all ${sign(d)}${STEP_LABEL[step]}`,
        group: "Timing",
        run: () => a.timingMoveAll(step, d),
      });
    }
  }
  for (const step of ["frame", "ms"] as TimingStep[]) {
    for (const d of [-1, 1] as Dir[]) {
      out.push({
        id: `timing.moveSelectedFollowing.${STEP_KEY[step]}.${dirKey(d)}`,
        label: `Move selected and following ${sign(d)}${STEP_LABEL[step]}`,
        group: "Timing",
        run: () => a.timingMoveSelected(step, d, true),
      });
    }
  }
  return out;
}

/** Playhead stepping (PLY-01). Arrows are text-editing keys, so all are outsideText. */
function stepCommands(): Command[] {
  const steps: { id: string; label: string; mod: string; run: (d: Dir) => void }[] = [
    { id: "frame", label: "1 frame", mod: "", run: (d) => stepFrame(d) },
    { id: "100ms", label: "100 ms", mod: "Shift+", run: (d) => jump(d * 0.1) },
    { id: "500ms", label: "500 ms", mod: "$mod+", run: (d) => jump(d * 0.5) },
    { id: "1s", label: "1 s", mod: "Control+Shift+", run: (d) => jump(d) },
  ];
  return steps.flatMap((step) =>
    ([-1, 1] as Dir[]).map((d) => ({
      id: `playback.step.${step.id}.${dirKey(d)}`,
      label: `${d < 0 ? "Back" : "Forward"} ${step.label}`,
      group: "Playback",
      keys: [`${step.mod}Arrow${d < 0 ? "Left" : "Right"}`],
      scope: "outsideText" as const,
      run: () => step.run(d),
    })),
  );
}

export const COMMANDS: Command[] = [
  /* ---------- File ---------- */
  { id: "file.new", label: "New", group: "File", keys: ["$mod+KeyN"], run: a.newFile },
  { id: "file.newKeepingVideo", label: "New keeping video", group: "File", run: a.newFileKeepingVideo },
  { id: "file.open", label: "Open subtitles…", group: "File", keys: ["$mod+KeyO"], run: () => a.openSubtitles(false) },
  { id: "file.openKeepingVideo", label: "Open keeping video…", group: "File", run: a.openSubtitlesKeepingVideo },
  { id: "file.importEncoding", label: "Import with encoding…", group: "File", run: a.openEncodingDialog },
  { id: "file.importPlainText", label: "Import plain text…", group: "File", run: a.importPlainTextFile },
  { id: "file.openOriginal", label: "Open original…", group: "File", run: a.openOriginalSubtitles },
  { id: "file.closeOriginal", label: "Close original", group: "File", run: a.closeOriginalAction },
  { id: "file.recent", label: "Recent files…", group: "File", run: a.openRecentDialog },
  { id: "file.recent.clear", label: "Clear recent files", group: "File", run: a.clearRecentFiles },
  { id: "file.openVideo", label: "Open video…", group: "File", keys: ["$mod+Shift+KeyO"], run: a.openVideo },
  { id: "file.save", label: "Save", group: "File", keys: ["$mod+KeyS"], run: a.save },
  { id: "file.saveAs", label: "Save as…", group: "File", keys: ["$mod+Shift+KeyS"], run: () => a.saveAs("srt") },
  { id: "file.saveAsVtt", label: "Export as WebVTT…", group: "File", run: () => a.saveAs("vtt") },
  { id: "file.saveSelected", label: "Save selected lines as…", group: "File", run: () => a.saveSelectedAs("srt") },
  { id: "file.openContainingFolder", label: "Open containing folder", group: "File", run: a.openContainingFolder },
  { id: "file.openDataFolder", label: "Open data folder", group: "File", run: a.openDataFolder },
  { id: "file.copyPath", label: "Copy subtitle path", group: "File", run: a.copySubtitlePath },
  { id: "file.reload", label: "Reload from disk", group: "File", run: a.reloadFromDisk },
  { id: "file.restoreBackup", label: "Restore auto-backup…", group: "File", run: a.openBackupDialog },
  { id: "file.compare", label: "Compare with file…", group: "File", run: a.compareWithFile },
  { id: "file.statistics", label: "Statistics…", group: "File", run: a.openStatistics },
  { id: "file.mediaInfo", label: "Media information…", group: "File", run: a.openMediaInfo },

  /* ---------- Tools ---------- */
  { id: "tools.ruleProfiles", label: "Rule profiles…", group: "Tools", run: openRuleProfiles },
  { id: "tools.fixCommon", label: "Fix common errors…", group: "Tools", run: a.openFixCommon },
  { id: "tools.beautify", label: "Beautify time codes…", group: "Tools", run: a.openBeautify },
  { id: "tools.spellCheck", label: "Spell check…", group: "Tools", run: a.openSpellCheck },
  { id: "tools.multipleReplace", label: "Multiple replace…", group: "Tools", run: a.openMultipleReplace },
  { id: "tools.textTools", label: "Change casing / merge…", group: "Tools", run: a.openTextTools },
  { id: "tools.removeHi", label: "Remove text for hearing impaired…", group: "Tools", run: a.openRemoveHi },

  /* ---------- Edit ---------- */
  { id: "edit.undo", label: "Undo", group: "Edit", keys: ["$mod+KeyZ"], run: a.undoAction },
  { id: "edit.redo", label: "Redo", group: "Edit", keys: ["$mod+Shift+KeyZ"], run: a.redoAction },
  { id: "edit.history", label: "Show history…", group: "Edit", run: a.openHistory },
  // Clipboard commands check focus themselves: text field → native, otherwise whole lines.
  { id: "edit.cut", label: "Cut", group: "Edit", keys: ["$mod+KeyX"], run: a.cutAction },
  { id: "edit.copy", label: "Copy", group: "Edit", keys: ["$mod+KeyC"], run: a.copyAction },
  { id: "edit.paste", label: "Paste", group: "Edit", keys: ["$mod+KeyV"], run: a.pasteAction },
  {
    id: "edit.pastePlainText",
    label: "Paste plain text",
    group: "Edit",
    keys: ["$mod+Shift+KeyV"],
    scope: "outsideText",
    run: a.pastePlainTextAction,
  },
  { id: "edit.pasteOriginal", label: "Paste original lines", group: "Edit", run: a.pasteOriginalAction },
  { id: "edit.selectAll", label: "Select all", group: "Edit", keys: ["$mod+KeyA"], run: a.selectAllAction },
  { id: "edit.invertSelection", label: "Invert selection", group: "Edit", run: a.invertSelectionAction },
  { id: "edit.find", label: "Find subtitle…", group: "Edit", keys: ["$mod+KeyF", "$mod+KeyK"], run: a.openFind },
  { id: "edit.replace", label: "Find and replace…", group: "Edit", keys: ["$mod+Alt+KeyF"], run: fr.openReplace },
  { id: "edit.findNext", label: "Find next", group: "Edit", keys: ["$mod+KeyG"], run: () => fr.findNext(1) },
  { id: "edit.findPrevious", label: "Find previous", group: "Edit", keys: ["$mod+Shift+KeyG"], run: () => fr.findNext(-1) },
  { id: "app.commandPalette", label: "Command palette…", group: "Edit", keys: ["$mod+Shift+KeyK"], run: a.openCommandPalette },

  { id: "edit.italic", label: "Italic", group: "Text", keys: ["$mod+KeyI"], run: a.toggleItalicAction },
  { id: "edit.toggleLineBreak", label: "Toggle line break", group: "Text", keys: ["$mod+Shift+KeyL"], run: a.toggleLineBreakAction },
  { id: "edit.unbreak", label: "Unbreak", group: "Text", keys: ["$mod+Shift+KeyR"], run: a.unbreakAction },
  { id: "edit.autoBreak", label: "Auto-break", group: "Text", keys: ["$mod+KeyR"], run: a.autoBreakAction },
  { id: "edit.balanceLines", label: "Balance lines", group: "Text", run: a.balanceLinesAction },
  { id: "edit.breakAtFirstSpace", label: "Break at first space", group: "Text", keys: ["$mod+Alt+Enter"], run: a.breakAtFirstSpaceAction },
  { id: "edit.toggleDialogDashes", label: "Toggle dialog dashes", group: "Text", keys: ["$mod+Shift+KeyD"], run: a.toggleDialogDashesAction },
  { id: "edit.trimWhitespace", label: "Trim whitespace", group: "Text", run: a.trimWhitespaceAction },

  { id: "edit.insertBefore", label: "Insert line before", group: "Lines", keys: ["$mod+Shift+Insert"], run: a.insertBeforeAction },
  { id: "edit.insertAfter", label: "Insert line after", group: "Lines", keys: ["$mod+Insert"], run: a.insertAfterAction },
  { id: "edit.insertAtEnd", label: "Insert line at end", group: "Lines", run: a.insertAtEndAction },
  { id: "edit.insertAtPlayhead", label: "Add subtitle at playhead", group: "Lines", run: a.addCueAtPlayhead },
  {
    id: "edit.deleteLines",
    label: "Delete lines",
    group: "Lines",
    keys: ["Backspace", "Delete", "$mod+Shift+Delete"],
    scope: "outsideText",
    run: a.deleteLinesAction,
  },
  { id: "edit.rippleDelete", label: "Ripple delete", group: "Lines", keys: ["$mod+Alt+Shift+Delete"], scope: "outsideText", run: a.rippleDeleteAction },
  { id: "edit.duplicate", label: "Duplicate lines", group: "Lines", keys: ["$mod+KeyD"], run: a.duplicateLinesAction },
  { id: "edit.removeBlankLines", label: "Remove blank lines", group: "Lines", run: a.removeBlankLinesAction },
  { id: "edit.splitAtCursor", label: "Split at cursor", group: "Lines", keys: ["$mod+KeyT"], run: a.splitAtCursorAction },
  { id: "edit.moveFirstWordFromNext", label: "Move first word from next line", group: "Lines", run: a.moveFirstWordFromNextAction },
  { id: "edit.moveLastWordToNext", label: "Move last word to next line", group: "Lines", run: a.moveLastWordToNextAction },
  { id: "edit.moveTextToNext", label: "Move text after cursor to next line", group: "Lines", keys: ["$mod+Alt+KeyT"], run: () => a.moveTextFromCursorToNextAction() },
  {
    id: "edit.moveTextToNextAndPlay",
    label: "Move text after cursor to next line and play",
    group: "Lines",
    keys: ["$mod+Alt+Shift+KeyT"],
    run: () => a.moveTextFromCursorToNextAction(true),
  },
  { id: "edit.splitAtVideo", label: "Split at video position", group: "Lines", keys: ["$mod+Shift+KeyT"], run: a.splitAtVideoAction },
  // ⌘⇧←/→ select to line start/end while typing, so merging only fires outside text.
  { id: "edit.mergePrevious", label: "Merge with previous", group: "Lines", keys: ["$mod+Shift+ArrowLeft"], scope: "outsideText", run: () => a.mergePreviousAction("keepBreaks") },
  { id: "edit.mergePrevious.unbreak", label: "Merge with previous (unbreak)", group: "Lines", run: () => a.mergePreviousAction("unbreak") },
  { id: "edit.mergePrevious.dialog", label: "Merge with previous (as dialog)", group: "Lines", run: () => a.mergePreviousAction("dialog") },
  { id: "edit.mergeNext", label: "Merge with next", group: "Lines", keys: ["$mod+Shift+ArrowRight"], scope: "outsideText", run: () => a.mergeNextAction("keepBreaks") },
  { id: "edit.mergeNext.unbreak", label: "Merge with next (unbreak)", group: "Lines", run: () => a.mergeNextAction("unbreak") },
  { id: "edit.mergeNext.dialog", label: "Merge with next (as dialog)", group: "Lines", run: () => a.mergeNextAction("dialog") },
  { id: "edit.mergeSelected", label: "Merge selected", group: "Lines", keys: ["$mod+Shift+KeyM"], run: () => a.mergeSelectedAction("keepBreaks") },
  { id: "edit.mergeSelected.unbreak", label: "Merge selected (unbreak)", group: "Lines", run: () => a.mergeSelectedAction("unbreak") },
  { id: "edit.mergeSelected.dialog", label: "Merge selected (as dialog)", group: "Lines", run: () => a.mergeSelectedAction("dialog") },

  /* ---------- Navigation & playback ---------- */
  { id: "nav.next", label: "Next subtitle", group: "Navigate", keys: ["ArrowDown"], scope: "outsideText", run: () => selectRelative(1) },
  { id: "nav.previous", label: "Previous subtitle", group: "Navigate", keys: ["ArrowUp"], scope: "outsideText", run: () => selectRelative(-1) },
  { id: "nav.focusText", label: "Edit subtitle text", group: "Navigate", keys: ["Enter"], scope: "outsideText", hidden: true, run: enterOutsideText },
  { id: "nav.toggleBookmark", label: "Toggle bookmark", group: "Navigate", keys: ["$mod+KeyB"], run: a.toggleBookmarkAction },
  { id: "nav.bookmarkNote", label: "Edit bookmark note…", group: "Navigate", keys: ["$mod+Shift+KeyB"], run: a.editBookmarkNote },
  { id: "nav.nextBookmark", label: "Next bookmark", group: "Navigate", keys: ["$mod+Alt+KeyB"], run: () => a.goToBookmark(1) },
  { id: "nav.previousBookmark", label: "Previous bookmark", group: "Navigate", keys: ["$mod+Alt+Shift+KeyB"], run: () => a.goToBookmark(-1) },
  { id: "nav.bookmarks", label: "Bookmarks…", group: "Navigate", run: a.openBookmarks },
  { id: "nav.goToLine", label: "Go to line number…", group: "Navigate", keys: ["$mod+KeyL"], run: openGoToLine },
  // Global, so they also get her out of the text box.
  { id: "nav.focusList", label: "Focus subtitle list", group: "Navigate", keys: ["$mod+Digit1"], run: focusSubtitleList },
  { id: "nav.focusTextBox", label: "Focus text box", group: "Navigate", keys: ["$mod+Digit2"], run: focusCueText },
  { id: "nav.focusWaveform", label: "Focus waveform", group: "Navigate", keys: ["$mod+Digit3"], run: focusWaveform },
  { id: "nav.nextError", label: "Go to next error", group: "Navigate", keys: ["$mod+Alt+ArrowDown"], scope: "outsideText", run: () => a.goToError(1) },
  { id: "nav.previousError", label: "Go to previous error", group: "Navigate", keys: ["$mod+Alt+ArrowUp"], scope: "outsideText", run: () => a.goToError(-1) },
  { id: "nav.nextEmpty", label: "Go to next empty line", group: "Navigate", run: a.goToNextEmpty },
  { id: "nav.nextFromVideo", label: "Go to next line from video position", group: "Navigate", keys: ["Alt+ArrowDown"], scope: "outsideText", run: () => a.goToLineFromVideo(1) },
  { id: "nav.previousFromVideo", label: "Go to previous line from video position", group: "Navigate", keys: ["Alt+ArrowUp"], scope: "outsideText", run: () => a.goToLineFromVideo(-1) },
  { id: "playback.toggle", label: "Play / pause", group: "Playback", keys: ["Space"], scope: "outsideText", run: () => clock.toggle() },
  // F-keys: global, so they work while she types in the text box (listen, then type).
  { id: "playback.playSelection", label: "Play selected line", group: "Playback", keys: ["F5"], run: () => playSelection() },
  { id: "playback.loopSelection", label: "Loop selected line", group: "Playback", keys: ["Shift+F5"], run: toggleLoopSelection },
  { id: "playback.playBefore", label: "Play from just before the line", group: "Playback", keys: ["F6"], run: playBeforeSelection },
  { id: "playback.playPrevious", label: "Play previous line", group: "Playback", keys: ["F7"], run: () => playNeighbour(-1) },
  { id: "playback.playNext", label: "Play next line", group: "Playback", keys: ["F8"], run: () => playNeighbour(1) },
  { id: "playback.loopPrevious", label: "Loop previous line", group: "Playback", keys: ["Shift+F7"], run: () => playNeighbour(-1, true) },
  { id: "playback.loopNext", label: "Loop next line", group: "Playback", keys: ["Shift+F8"], run: () => playNeighbour(1, true) },
  { id: "nav.nextAndPlay", label: "Go to next line and play", group: "Navigate", keys: ["$mod+Shift+Enter"], run: goToNextAndPlay },
  ...stepCommands(),
  { id: "playback.speed.faster", label: "Faster playback", group: "Playback", run: () => changeSpeed(1) },
  { id: "playback.speed.slower", label: "Slower playback", group: "Playback", run: () => changeSpeed(-1) },
  { id: "playback.speed.normal", label: "Normal speed", group: "Playback", run: resetSpeed },
  ...AUDIO_TRACK_COMMANDS,

  /* ---------- View ---------- */
  { id: "view.theme.system", label: "Theme: match system", group: "View", run: () => setTheme("system") },
  { id: "view.theme.light", label: "Theme: light", group: "View", run: () => setTheme("light") },
  { id: "view.theme.dark", label: "Theme: dark", group: "View", run: () => setTheme("dark") },
  { id: "view.density.compact", label: "Row density: compact", group: "View", run: () => setDensity("compact") },
  { id: "view.density.comfortable", label: "Row density: comfortable", group: "View", run: () => setDensity("comfortable") },
  { id: "view.timecode", label: "Toggle frames / milliseconds", group: "View", run: toggleTimecode },
  { id: "view.column.cps", label: "Toggle CPS column", group: "View", run: a.toggleCpsColumn },
  { id: "view.column.gap", label: "Toggle gap column", group: "View", run: a.toggleGapColumn },
  { id: "view.column.original", label: "Toggle original column", group: "View", run: a.toggleOriginalColumn },
  { id: "view.formatting", label: "Toggle formatting in grid", group: "View", run: a.toggleFormattingInGrid },
  { id: "view.errors", label: "List errors", group: "View", run: a.toggleErrorsList },
  { id: "view.privacy", label: "Screen privacy", group: "View", keys: ["$mod+Shift+KeyP"], run: a.togglePrivacyAction },
  { id: "view.preview.box", label: "Subtitle preview: background box", group: "View", run: () => setPreview({ background: "box" }) },
  { id: "view.preview.outline", label: "Subtitle preview: outline", group: "View", run: () => setPreview({ background: "outline" }) },
  { id: "view.preview.bigger", label: "Subtitle preview: bigger text", group: "View", run: () => stepPreviewSize(1) },
  { id: "view.preview.smaller", label: "Subtitle preview: smaller text", group: "View", run: () => stepPreviewSize(-1) },
  { id: "view.preview.higher", label: "Subtitle preview: move up", group: "View", run: () => stepPreviewPosition(1) },
  { id: "view.preview.lower", label: "Subtitle preview: move down", group: "View", run: () => stepPreviewPosition(-1) },

  /* ---------- Timing ---------- */
  ...edgeCommands("start"),
  ...edgeCommands("end"),
  ...shiftCommands(),
  {
    id: "timing.holdToTime",
    label: "Hold to time: add at video, end on key release",
    group: "Timing",
    keys: ["KeyH"],
    scope: "outsideText",
    run: holdToTimeStart,
    release: holdToTimeEnd,
  },
  { id: "timing.setStart", label: "Set start at video", group: "Timing", keys: ["F11"], run: a.timingSetStart },
  { id: "timing.setEnd", label: "Set end at video", group: "Timing", keys: ["F12"], run: a.timingSetEnd },
  { id: "timing.setStartGoNext", label: "Set start and go to next", group: "Timing", run: a.timingSetStartGoNext },
  { id: "timing.setEndGoNext", label: "Set end and go to next", group: "Timing", keys: ["F10"], run: a.timingSetEndGoNext },
  { id: "timing.setStartKeepDuration", label: "Set start (keep duration)", group: "Timing", run: a.timingSetStartKeepDuration },
  { id: "timing.setStartOffsetRest", label: "Set start and offset the rest", group: "Timing", keys: ["F9"], run: a.timingSetStartOffsetRest },
  { id: "timing.setEndAddNew", label: "Set end, add new and go to new", group: "Timing", keys: ["Shift+F10"], run: a.timingSetEndAddNew },
  { id: "timing.setEndAndNextAfterGap", label: "Set end and start of next after gap", group: "Timing", run: a.timingSetEndAndNextAfterGap },
  { id: "timing.setStartAndPrevMinusGap", label: "Set start and end of previous minus gap", group: "Timing", run: a.timingSetStartAndPrevMinusGap },
  { id: "timing.extendToPrevious", label: "Extend to previous subtitle", group: "Timing", keys: ["Alt+Shift+KeyE"], run: a.timingExtendToPrevious },
  { id: "timing.extendToNext", label: "Extend to next subtitle", group: "Timing", keys: ["$mod+Shift+KeyE"], run: a.timingExtendToNext },
  { id: "timing.extendPreviousEnd", label: "Extend previous end to selected", group: "Timing", run: a.timingExtendPreviousEnd },
  { id: "timing.extendNextStart", label: "Extend next start to selected", group: "Timing", run: a.timingExtendNextStart },
  { id: "timing.snapAllToFrames", label: "Snap all times to frames", group: "Timing", run: a.timingSnapAllToFrames },

  /* ---------- Sync ---------- */
  {
    id: "sync.adjustTimes",
    label: "Adjust times by offset…",
    group: "Sync",
    keys: ["$mod+Shift+KeyA"],
    run: openAdjustTimes,
  },
  {
    id: "sync.visualSync",
    label: "Visual sync…",
    group: "Sync",
    keys: ["$mod+Alt+KeyV"],
    run: openVisualSync,
  },
  {
    id: "sync.changeFrameRate",
    label: "Change frame rate…",
    group: "Sync",
    run: openChangeFrameRate,
  },
  {
    id: "sync.changeSpeed",
    label: "Change speed…",
    group: "Sync",
    run: openChangeSpeed,
  },

  /* ---------- Waveform ---------- */
  ...WAVEFORM_COMMANDS,
];

let registered = false;

/** Registers every command once (idempotent for hot reload). */
export function registerCommands() {
  if (registered) return;
  registered = true;
  defineCommands(COMMANDS);
}
