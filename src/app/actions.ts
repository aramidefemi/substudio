import { ask, open, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { create } from "zustand";
import { clock } from "@/features/playback/clock";
import {
  clearRecent,
  cyclePrivacy,
  pushRecentSubtitle,
  pushRecentVideo,
  setShowCpsColumn,
  setShowFormattingInGrid,
  setShowGapColumn,
  useSettings,
} from "@/features/settings/store";
import { nextBookmarkIndex } from "@/features/subtitles/bookmarks";
import { parseCues, serializeCues } from "@/features/subtitles/clipboard";
import { toggleItalic } from "@/features/subtitles/format";
import {
  deleteSelected,
  duplicateSelected,
  extendNextStartToCurrent,
  extendPreviousEndToCurrent,
  extendSelectedToNext,
  extendSelectedToPrevious,
  insertAfterSelected,
  insertAtEnd,
  insertBeforeSelected,
  insertCue,
  invertSelection,
  loadDocument,
  mapSelectedTexts,
  markSaved,
  mergeSelected,
  mergeWithNext,
  mergeWithPrevious,
  moveAllBy,
  moveSelectedBy,
  newDocument,
  nudgeSelectedEdgeBy,
  pasteCues,
  redo,
  removeBlankLines,
  removeCues,
  restoreBookmarks,
  rippleDeleteSelected,
  select,
  selectAll,
  selectRelative,
  selectedCues,
  setEndAddNewAndGoToNew,
  setEndAndGoToNext,
  setEndAndStartOfNextAfterGap,
  setKnownMtime,
  setSelectedEndAt,
  setSelectedStartAt,
  setStartAndEndOfPreviousMinusGap,
  setStartAndGoToNext,
  setVideo,
  snapAllTimesToFrames,
  splitSelectedAtCursor,
  splitSelectedAtTime,
  toggleBookmark,
  undo,
  updateCue,
  useSubtitles,
  type MergeMode,
  type TimingStep,
} from "@/features/subtitles/store";
import type { NudgeMode } from "@/features/subtitles/timing";
import {
  autoBreak,
  balanceLines,
  breakAtFirstSpace,
  toggleDialogDashes,
  toggleLineBreak,
  trimWhitespace,
  unbreak,
} from "@/features/subtitles/textOps";
import type { CueData, SubtitleFormat } from "@/features/subtitles/types";
import { cueTextSelection, focusCueText, isEditable, setCueTextSelection } from "@/lib/dom";
import { commands, fileName, inTauri, stripExtension } from "@/lib/tauri";
import { planDrop, SUBTITLE_EXTENSIONS, VIDEO_EXTENSIONS } from "./drop";
import { buildProject, restoreProject } from "./project";

/** Transient UI state that several components toggle. */
export const useUi = create<{
  findOpen: boolean;
  recentOpen: boolean;
  encodingOpen: boolean;
  backupOpen: boolean;
  statsOpen: boolean;
  compareOpen: boolean;
  compareOther: { path: string; cues: CueData[] } | null;
  mediaInfoOpen: boolean;
  historyOpen: boolean;
  paletteOpen: boolean;
  errorsOpen: boolean;
  bookmarksOpen: boolean;
  /** Cue whose bookmark note is being edited, if any. */
  bookmarkNoteFor: string | null;
}>()(() => ({
  findOpen: false,
  recentOpen: false,
  encodingOpen: false,
  backupOpen: false,
  statsOpen: false,
  compareOpen: false,
  compareOther: null,
  mediaInfoOpen: false,
  historyOpen: false,
  paletteOpen: false,
  errorsOpen: false,
  bookmarksOpen: false,
  bookmarkNoteFor: null,
}));

const SUBTITLE_FILTER = { name: "Subtitles", extensions: SUBTITLE_EXTENSIONS };
const VIDEO_FILTER = { name: "Video", extensions: VIDEO_EXTENSIONS };

const desktopOnly = () => {
  toast("Files open in the desktop app", { description: "Run `pnpm tauri dev` instead of `pnpm dev`." });
  return false;
};

const isTextField = (el: Element | null) =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

async function confirmDiscard(): Promise<boolean> {
  if (!useSubtitles.getState().dirty) return true;
  const message = "You have unsaved changes. Discard them?";
  return inTauri ? ask(message, { title: "Substudio", kind: "warning" }) : window.confirm(message);
}

function formatOf(path: string): SubtitleFormat {
  return path.toLowerCase().endsWith(".vtt") ? "vtt" : "srt";
}

async function rememberMtime(path: string) {
  try {
    setKnownMtime(await commands.fileMtime(path));
  } catch {
    setKnownMtime(null);
  }
}

/* ---------- project sidecar (FIL-03) ---------- */

/** Seeks once the newly set video has its metadata (a seek before that is lost). */
function seekWhenVideoReady(t: number) {
  const off = clock.onTick(() => {
    const video = document.querySelector("video");
    if (video && video.readyState >= 1) {
      off();
      clock.seek(t);
    }
  });
  window.setTimeout(off, 15_000);
}

/** Restores video, fps, timecode, bookmarks and the last selected line. Missing or bad sidecar: nothing happens. */
async function applySidecar(path: string) {
  let file;
  try {
    file = await commands.readProject(path);
  } catch {
    return;
  }
  if (!file) return;
  const s = useSubtitles.getState();
  const p = restoreProject(s.cues, file);
  restoreBookmarks(p.bookmarks);
  if (p.fps || p.timecode) {
    useSubtitles.setState({ ...(p.fps ? { fps: p.fps } : {}), ...(p.timecode ? { timecode: p.timecode } : {}) });
  }
  let videoSet = false;
  if (p.videoPath && !s.videoPath) {
    try {
      await commands.fileMtime(p.videoPath); // exists?
      setVideo(p.videoPath);
      pushRecentVideo(p.videoPath);
      videoSet = true;
    } catch {
      toast("Video not found", { description: `${fileName(p.videoPath)} — open it again with ⇧⌘O.` });
    }
  }
  const cue = useSubtitles.getState().cues[p.selectedIndex];
  if (cue) {
    select(cue.id);
    if (videoSet) seekWhenVideoReady(cue.start);
    else clock.seek(cue.start);
  }
}

/** Written next to the subtitle on every save; never blocks or fails the save itself. */
async function writeSidecar(path: string) {
  try {
    await commands.writeProject(path, buildProject(useSubtitles.getState()));
  } catch (err) {
    console.warn("Could not write the project sidecar", err);
  }
}

async function openSubtitlePath(path: string, keepVideo: boolean, encoding?: string) {
  const cues = encoding
    ? await commands.readSubtitlesEncoded(path, encoding)
    : await commands.readSubtitles(path);
  loadDocument(cues, path, keepVideo);
  await rememberMtime(path);
  await applySidecar(path);
  pushRecentSubtitle(path, useSubtitles.getState().videoPath);
  toast.success(`Opened ${fileName(path)}`, { description: `${cues.length} subtitles` });
}

export async function newFile() {
  if (!(await confirmDiscard())) return;
  newDocument(false);
  setKnownMtime(null);
}

export async function newFileKeepingVideo() {
  if (!(await confirmDiscard())) return;
  newDocument(true);
  setKnownMtime(null);
}

export async function openSubtitles(keepVideo = false) {
  if (!inTauri) return desktopOnly();
  if (!(await confirmDiscard())) return;
  const path = await open({ filters: [SUBTITLE_FILTER] });
  if (!path) return;
  try {
    await openSubtitlePath(path, keepVideo);
  } catch (err) {
    toast.error(`Could not open ${fileName(path)}`, { description: String(err) });
  }
}

export async function openSubtitlesKeepingVideo() {
  return openSubtitles(true);
}

export async function openRecentSubtitle(path: string, videoPath?: string | null) {
  if (!inTauri) return desktopOnly();
  if (!(await confirmDiscard())) return;
  try {
    await openSubtitlePath(path, true);
    if (videoPath) {
      setVideo(videoPath);
      pushRecentVideo(videoPath);
    }
  } catch (err) {
    toast.error(`Could not open ${fileName(path)}`, { description: String(err) });
  }
}

export async function openRecentVideo(path: string) {
  if (!inTauri) return desktopOnly();
  setVideo(path);
  pushRecentVideo(path);
}

export async function openVideo() {
  if (!inTauri) return desktopOnly();
  const path = await open({ filters: [VIDEO_FILTER] });
  if (!path) return;
  setVideo(path);
  pushRecentVideo(path);
}

/**
 * Files dropped on the window: a subtitle opens (keeping the current video,
 * since dropping a subtitle onto a film means "use it with this"), a video
 * replaces the current one. Both together open as a pair.
 */
export async function openDroppedFiles(paths: readonly string[]) {
  const plan = planDrop(paths);
  if (!plan.subtitle && !plan.video) {
    toast.error("Can't open this file", { description: "Drop a .srt or .vtt subtitle, or an .mp4, .mov, .m4v or .webm video." });
    return;
  }
  if (plan.subtitle) {
    if (!(await confirmDiscard())) return;
    try {
      await openSubtitlePath(plan.subtitle, true);
    } catch (err) {
      toast.error(`Could not open ${fileName(plan.subtitle)}`, { description: String(err) });
      return;
    }
  }
  if (plan.video) {
    setVideo(plan.video);
    pushRecentVideo(plan.video);
    if (plan.subtitle) pushRecentSubtitle(plan.subtitle, plan.video);
    else toast.success(`Opened ${fileName(plan.video)}`);
  }
  if (plan.ignored.length) {
    toast(`Skipped ${plan.ignored.length} file${plan.ignored.length === 1 ? "" : "s"}`, {
      description: plan.ignored.map(fileName).join(", "),
    });
  }
}

async function writeTo(path: string, format: SubtitleFormat) {
  try {
    await commands.writeSubtitles(path, useSubtitles.getState().cues, format);
    markSaved(path);
    await rememberMtime(path);
    await writeSidecar(path);
    pushRecentSubtitle(path, useSubtitles.getState().videoPath);
    toast.success(`Saved ${fileName(path)}`);
  } catch (err) {
    toast.error("Could not save", { description: String(err) });
  }
}

export async function saveAs(format: SubtitleFormat = "srt") {
  if (!inTauri) return desktopOnly();
  const { filePath, videoPath } = useSubtitles.getState();
  const base = stripExtension(fileName(filePath ?? videoPath ?? "Untitled"));
  const path = await saveDialog({
    defaultPath: `${base}.${format}`,
    filters: [format === "vtt" ? { name: "WebVTT", extensions: ["vtt"] } : { name: "SubRip", extensions: ["srt"] }],
  });
  if (path) await writeTo(path, format);
}

export async function save() {
  const { filePath } = useSubtitles.getState();
  if (!filePath || !inTauri) return saveAs("srt");
  await writeTo(filePath, formatOf(filePath));
}

export async function importWithEncoding(encoding: string) {
  if (!inTauri) return desktopOnly();
  if (!(await confirmDiscard())) return;
  const path = await open({ filters: [SUBTITLE_FILTER], title: `Import (${encoding})` });
  if (!path) return;
  try {
    await openSubtitlePath(path, true, encoding);
  } catch (err) {
    toast.error(`Could not import ${fileName(path)}`, { description: String(err) });
  }
}

export async function openContainingFolder() {
  if (!inTauri) return desktopOnly();
  const { filePath, videoPath } = useSubtitles.getState();
  const path = filePath ?? videoPath;
  if (!path) {
    toast("Nothing to reveal", { description: "Open a subtitle or video first." });
    return;
  }
  try {
    await commands.revealPath(path);
  } catch (err) {
    toast.error("Could not open folder", { description: String(err) });
  }
}

export async function openDataFolder() {
  if (!inTauri) return desktopOnly();
  try {
    const dir = await commands.ensureDataFolder();
    await commands.openPath(dir);
  } catch (err) {
    toast.error("Could not open data folder", { description: String(err) });
  }
}

export async function reloadFromDisk() {
  if (!inTauri) return desktopOnly();
  const { filePath, dirty } = useSubtitles.getState();
  if (!filePath) {
    toast("No file to reload");
    return;
  }
  if (dirty) {
    const ok = await ask("Reload and discard unsaved changes?", { title: "Substudio", kind: "warning" });
    if (!ok) return;
  }
  try {
    await openSubtitlePath(filePath, true);
  } catch (err) {
    toast.error("Could not reload", { description: String(err) });
  }
}

/** Called when the on-disk file changed outside the app. */
export async function onExternalFileChange() {
  const { filePath, dirty } = useSubtitles.getState();
  if (!filePath) return;
  const name = fileName(filePath);
  if (dirty) {
    const reload = await ask(`${name} changed on disk. Reload and discard your unsaved edits?`, {
      title: "File changed",
      kind: "warning",
    });
    if (reload) await openSubtitlePath(filePath, true);
    else await rememberMtime(filePath);
    return;
  }
  const reload = await ask(`${name} changed on disk. Reload?`, { title: "File changed", kind: "info" });
  if (reload) await openSubtitlePath(filePath, true);
  else await rememberMtime(filePath);
}

export async function restoreBackup(path: string) {
  if (!inTauri) return desktopOnly();
  if (!(await confirmDiscard())) return;
  try {
    const cues = await commands.readSubtitles(path);
    loadDocument(cues, null, true);
    setKnownMtime(null);
    toast.success("Restored auto-backup", { description: `${cues.length} subtitles — save to keep` });
  } catch (err) {
    toast.error("Could not restore backup", { description: String(err) });
  }
}

/** Periodic safety net: write a backup always; also save over the open path when set. */
export async function runAutoBackup() {
  if (!inTauri) return;
  const { dirty, cues, filePath, videoPath } = useSubtitles.getState();
  if (!dirty || !cues.length) return;
  const { autoBackupKeep } = useSettings.getState();
  const label = fileName(filePath ?? videoPath ?? "Untitled.srt");
  const format = formatOf(label);
  try {
    await commands.writeAutoBackup(label, cues, format, autoBackupKeep);
    if (filePath) {
      await commands.writeSubtitles(filePath, cues, formatOf(filePath));
      markSaved(filePath);
      await rememberMtime(filePath);
      await writeSidecar(filePath);
    }
  } catch (err) {
    console.error("auto-backup failed", err);
  }
}

export function clearRecentFiles() {
  clearRecent();
  toast.success("Recent files cleared");
}

/** In a text field, undo/redo edit the text natively; elsewhere they walk the subtitle history. */
export function undoAction() {
  if (isTextField(document.activeElement)) document.execCommand("undo");
  else if (!undo()) toast("Nothing to undo");
}

export function redoAction() {
  if (isTextField(document.activeElement)) document.execCommand("redo");
  else if (!redo()) toast("Nothing to redo");
}

export const openFind = () => useUi.setState({ findOpen: true });
export const openRecentDialog = () => useUi.setState({ recentOpen: true });
export const openEncodingDialog = () => useUi.setState({ encodingOpen: true });
export const openBackupDialog = () => useUi.setState({ backupOpen: true });
export const openStatistics = () => useUi.setState({ statsOpen: true });
export const openMediaInfo = () => {
  if (!useSubtitles.getState().videoPath) {
    toast("No video open", { description: "Open a video to see media information." });
    return;
  }
  useUi.setState({ mediaInfoOpen: true });
};
export const openHistory = () => useUi.setState({ historyOpen: true });
export const openCommandPalette = () => useUi.setState({ paletteOpen: true });
/* ---------- bookmarks (NAV-02) ---------- */

export function toggleBookmarkAction() {
  const { cues, selectedId } = useSubtitles.getState();
  const index = cues.findIndex((c) => c.id === selectedId);
  const on = toggleBookmark();
  if (on === null) return;
  toast(on ? `Bookmarked line ${index + 1}` : `Removed bookmark from line ${index + 1}`);
}

export function editBookmarkNote() {
  const { selectedId } = useSubtitles.getState();
  if (!selectedId) return;
  useUi.setState({ bookmarkNoteFor: selectedId });
}

export function goToBookmark(dir: 1 | -1) {
  const s = useSubtitles.getState();
  const i = nextBookmarkIndex(s.cues, s.cues.findIndex((c) => c.id === s.selectedId), dir);
  if (i < 0) {
    toast("No bookmarks", { description: "Bookmark a line with ⌘B." });
    return;
  }
  const cue = s.cues[i]!;
  select(cue.id);
  clock.seek(cue.start);
}

export const openBookmarks = () => useUi.setState({ bookmarksOpen: true });

export const toggleErrorsList = () => useUi.setState((s) => ({ errorsOpen: !s.errorsOpen }));
export const addCueAtPlayhead = () => insertCue(clock.time);

export async function copySubtitlePath() {
  const { filePath } = useSubtitles.getState();
  if (!filePath) {
    toast("No subtitle path", { description: "Save or open a subtitle file first." });
    return;
  }
  try {
    await navigator.clipboard.writeText(filePath);
    toast.success("Copied subtitle path");
  } catch (err) {
    toast.error("Could not copy path", { description: String(err) });
  }
}

export async function saveSelectedAs(format: SubtitleFormat = "srt") {
  if (!inTauri) return desktopOnly();
  const cues = selectedCues();
  if (!cues.length) {
    toast("No lines selected");
    return;
  }
  const { filePath, videoPath } = useSubtitles.getState();
  const base = stripExtension(fileName(filePath ?? videoPath ?? "Untitled"));
  const path = await saveDialog({
    defaultPath: `${base}.selection.${format}`,
    filters: [format === "vtt" ? { name: "WebVTT", extensions: ["vtt"] } : { name: "SubRip", extensions: ["srt"] }],
  });
  if (!path) return;
  try {
    await commands.writeSubtitles(path, cues, format);
    toast.success(`Saved ${cues.length} line${cues.length === 1 ? "" : "s"}`, {
      description: fileName(path),
    });
  } catch (err) {
    toast.error("Could not save selection", { description: String(err) });
  }
}

export async function compareWithFile() {
  if (!inTauri) return desktopOnly();
  const path = await open({ filters: [SUBTITLE_FILTER], title: "Compare with…" });
  if (!path) return;
  try {
    const cues = await commands.readSubtitles(path);
    useUi.setState({ compareOther: { path, cues }, compareOpen: true });
  } catch (err) {
    toast.error(`Could not open ${fileName(path)}`, { description: String(err) });
  }
}

async function writeClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

async function readClipboard(): Promise<string> {
  return navigator.clipboard.readText();
}

/** Grid line copy when focus isn't in a text field; otherwise native text copy. */
export async function copyAction() {
  if (isEditable(document.activeElement)) {
    document.execCommand("copy");
    return;
  }
  const cues = selectedCues();
  if (!cues.length) return;
  try {
    await writeClipboard(serializeCues(cues));
    toast.success(`Copied ${cues.length} line${cues.length === 1 ? "" : "s"}`);
  } catch (err) {
    toast.error("Could not copy", { description: String(err) });
  }
}

export async function cutAction() {
  if (isEditable(document.activeElement)) {
    document.execCommand("cut");
    return;
  }
  const cues = selectedCues();
  if (!cues.length) return;
  try {
    await writeClipboard(serializeCues(cues));
    removeCues(cues.map((c) => c.id));
    toast.success(`Cut ${cues.length} line${cues.length === 1 ? "" : "s"}`);
  } catch (err) {
    toast.error("Could not cut", { description: String(err) });
  }
}

export async function pasteAction() {
  if (isEditable(document.activeElement)) {
    document.execCommand("paste");
    return;
  }
  try {
    const cues = parseCues(await readClipboard());
    if (!cues) {
      toast("Clipboard has no subtitle lines");
      return;
    }
    pasteCues(cues);
    toast.success(`Pasted ${cues.length} line${cues.length === 1 ? "" : "s"}`);
  } catch (err) {
    toast.error("Could not paste", { description: String(err) });
  }
}

export function selectAllAction() {
  if (isEditable(document.activeElement)) document.execCommand("selectAll");
  else selectAll();
}

export function invertSelectionAction() {
  if (isEditable(document.activeElement)) return;
  invertSelection();
}

export function togglePrivacyAction() {
  const mode = cyclePrivacy();
  toast(
    mode === "off" ? "Screen privacy off" : mode === "names" ? "Hiding file names" : "Hiding file names and text",
  );
}

export function toggleCpsColumn() {
  const next = !useSettings.getState().showCpsColumn;
  setShowCpsColumn(next);
}

export function toggleGapColumn() {
  const next = !useSettings.getState().showGapColumn;
  setShowGapColumn(next);
}

export function toggleFormattingInGrid() {
  const next = !useSettings.getState().showFormattingInGrid;
  setShowFormattingInGrid(next);
  toast(next ? "Showing formatting in grid" : "Hiding tags in grid");
}

/* ---------- timing (keyboard + menu) ---------- */

const playhead = () => clock.time;

export const timingMoveStart = (step: TimingStep, dir: 1 | -1, mode: NudgeMode = "plain") =>
  nudgeSelectedEdgeBy("start", step, dir, mode);
export const timingMoveEnd = (step: TimingStep, dir: 1 | -1, mode: NudgeMode = "plain") =>
  nudgeSelectedEdgeBy("end", step, dir, mode);
export const timingMoveSelected = (step: TimingStep, dir: 1 | -1, withFollowing = false) =>
  moveSelectedBy(step, dir, withFollowing);
export const timingMoveAll = (step: TimingStep, dir: 1 | -1) => moveAllBy(step, dir);

export const timingSetStart = () => setSelectedStartAt(playhead());
export const timingSetEnd = () => setSelectedEndAt(playhead());
export const timingSetStartGoNext = () => setStartAndGoToNext(playhead());
export const timingSetEndGoNext = () => setEndAndGoToNext(playhead());
export const timingSetStartKeepDuration = () => setSelectedStartAt(playhead(), { keepDuration: true });
export const timingSetStartOffsetRest = () => setSelectedStartAt(playhead(), { offsetRest: true });
export const timingSetEndAddNew = () => setEndAddNewAndGoToNew(playhead());
export const timingSetEndAndNextAfterGap = () => setEndAndStartOfNextAfterGap(playhead());
export const timingSetStartAndPrevMinusGap = () => setStartAndEndOfPreviousMinusGap(playhead());
export const timingExtendToPrevious = () => extendSelectedToPrevious();
export const timingExtendToNext = () => extendSelectedToNext();
export const timingExtendPreviousEnd = () => extendPreviousEndToCurrent();
export const timingExtendNextStart = () => extendNextStartToCurrent();
export const timingSnapAllToFrames = () => {
  snapAllTimesToFrames();
  toast.success("Snapped all times to frames");
};

/* ---------- text box ---------- */

function primaryCue() {
  const { cues, selectedId } = useSubtitles.getState();
  return cues.find((c) => c.id === selectedId) ?? null;
}

/** Apply a text transform to the primary cue; restore caret when the text box is focused. */
function editPrimaryText(
  fn: (text: string, sel: { start: number; end: number }) => { text: string; start: number; end: number },
) {
  const cue = primaryCue();
  if (!cue) return;
  const focused = cueTextSelection();
  const sel = focused ?? { start: 0, end: cue.text.length };
  const next = fn(cue.text, sel);
  if (next.text === cue.text && next.start === sel.start && next.end === sel.end) return;
  updateCue(cue.id, { text: next.text });
  if (focused) requestAnimationFrame(() => setCueTextSelection(next.start, next.end));
}

export function toggleItalicAction() {
  editPrimaryText((text, sel) => toggleItalic(text, sel.start, sel.end));
}

export function toggleLineBreakAction() {
  editPrimaryText((text, sel) => {
    const cursor = sel.start === sel.end ? sel.start : Math.max(sel.start, sel.end);
    const next = toggleLineBreak(text, cursor);
    return { text: next.text, start: next.cursor, end: next.cursor };
  });
}

export function unbreakAction() {
  mapSelectedTexts(unbreak);
}

export function autoBreakAction() {
  mapSelectedTexts(autoBreak);
}

export function balanceLinesAction() {
  mapSelectedTexts(balanceLines);
}

export function breakAtFirstSpaceAction() {
  const cue = primaryCue();
  if (!cue) return;
  const focused = cueTextSelection();
  const cursor = focused ? focused.start : 0;
  const next = breakAtFirstSpace(cue.text, cursor);
  if (!next) return;
  updateCue(cue.id, { text: next.text });
  selectRelative(1);
  requestAnimationFrame(() => focusCueText());
}

export function toggleDialogDashesAction() {
  mapSelectedTexts(toggleDialogDashes);
}

export function trimWhitespaceAction() {
  mapSelectedTexts(trimWhitespace);
}

export const insertBeforeAction = () => insertBeforeSelected();
export const insertAfterAction = () => insertAfterSelected();
export const insertAtEndAction = () => insertAtEnd();
export const deleteLinesAction = () => deleteSelected();
export const rippleDeleteAction = () => rippleDeleteSelected();
export const duplicateLinesAction = () => duplicateSelected();
export const removeBlankLinesAction = () => removeBlankLines();

export function splitAtCursorAction() {
  const cue = primaryCue();
  if (!cue) return;
  const focused = cueTextSelection();
  const cursor = focused ? focused.start : Math.floor(cue.text.length / 2);
  splitSelectedAtCursor(cursor);
  requestAnimationFrame(() => focusCueText());
}

export const splitAtVideoAction = () => {
  splitSelectedAtTime(clock.time);
  requestAnimationFrame(() => focusCueText());
};

export const mergePreviousAction = (mode: MergeMode = "keepBreaks") => mergeWithPrevious(mode);
export const mergeNextAction = (mode: MergeMode = "keepBreaks") => mergeWithNext(mode);
export const mergeSelectedAction = (mode: MergeMode = "keepBreaks") => mergeSelected(mode);
