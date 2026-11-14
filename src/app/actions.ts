import { ask, open, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { create } from "zustand";
import { clock } from "@/features/playback/clock";
import {
  clearRecent,
  cyclePrivacy,
  pushRecentSubtitle,
  pushRecentVideo,
  setDensity,
  setShowCpsColumn,
  setShowFormattingInGrid,
  setShowGapColumn,
  setTheme,
  useSettings,
} from "@/features/settings/store";
import { parseCues, serializeCues } from "@/features/subtitles/clipboard";
import { toggleItalic } from "@/features/subtitles/format";
import {
  extendNextStartToCurrent,
  extendPreviousEndToCurrent,
  extendSelectedToNext,
  extendSelectedToPrevious,
  insertCue,
  invertSelection,
  loadDocument,
  mapSelectedTexts,
  markSaved,
  moveAllBy,
  moveSelectedBy,
  newDocument,
  nudgeSelectedEdgeBy,
  pasteCues,
  redo,
  removeCues,
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
  toggleTimecode,
  undo,
  updateCue,
  useSubtitles,
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
import type { SubtitleFormat } from "@/features/subtitles/types";
import { cueTextSelection, focusCueText, isEditable, setCueTextSelection } from "@/lib/dom";
import { commands, fileName, inTauri, stripExtension } from "@/lib/tauri";

/** Transient UI state that several components toggle. */
export const useUi = create<{
  findOpen: boolean;
  recentOpen: boolean;
  encodingOpen: boolean;
  backupOpen: boolean;
}>()(() => ({
  findOpen: false,
  recentOpen: false,
  encodingOpen: false,
  backupOpen: false,
}));

const SUBTITLE_FILTER = { name: "Subtitles", extensions: ["srt", "vtt"] };
const VIDEO_FILTER = { name: "Video", extensions: ["mp4", "mov", "m4v", "webm"] };

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

async function openSubtitlePath(path: string, keepVideo: boolean, encoding?: string) {
  const cues = encoding
    ? await commands.readSubtitlesEncoded(path, encoding)
    : await commands.readSubtitles(path);
  loadDocument(cues, path, keepVideo);
  await rememberMtime(path);
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

async function writeTo(path: string, format: SubtitleFormat) {
  try {
    await commands.writeSubtitles(path, useSubtitles.getState().cues, format);
    markSaved(path);
    await rememberMtime(path);
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
export const addCueAtPlayhead = () => insertCue(clock.time);

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

/** Ids match the native menu items in `src-tauri/src/menu.rs`. */
const ACTIONS: Record<string, () => unknown> = {
  "file.new": newFile,
  "file.newKeepingVideo": newFileKeepingVideo,
  "file.open": () => openSubtitles(false),
  "file.openKeepingVideo": openSubtitlesKeepingVideo,
  "file.importEncoding": openEncodingDialog,
  "file.recent": openRecentDialog,
  "file.recent.clear": clearRecentFiles,
  "file.openVideo": openVideo,
  "file.save": save,
  "file.saveAs": () => saveAs("srt"),
  "file.openContainingFolder": openContainingFolder,
  "file.openDataFolder": openDataFolder,
  "file.reload": reloadFromDisk,
  "file.restoreBackup": openBackupDialog,
  "edit.undo": undoAction,
  "edit.redo": redoAction,
  "edit.cut": () => void cutAction(),
  "edit.copy": () => void copyAction(),
  "edit.paste": () => void pasteAction(),
  "edit.selectAll": selectAllAction,
  "edit.invertSelection": invertSelectionAction,
  "edit.find": openFind,
  "edit.italic": toggleItalicAction,
  "edit.toggleLineBreak": toggleLineBreakAction,
  "edit.unbreak": unbreakAction,
  "edit.autoBreak": autoBreakAction,
  "edit.balanceLines": balanceLinesAction,
  "edit.breakAtFirstSpace": breakAtFirstSpaceAction,
  "edit.toggleDialogDashes": toggleDialogDashesAction,
  "edit.trimWhitespace": trimWhitespaceAction,
  "view.theme.system": () => setTheme("system"),
  "view.theme.light": () => setTheme("light"),
  "view.theme.dark": () => setTheme("dark"),
  "view.density.compact": () => setDensity("compact"),
  "view.density.comfortable": () => setDensity("comfortable"),
  "view.timecode": toggleTimecode,
  "view.column.cps": toggleCpsColumn,
  "view.column.gap": toggleGapColumn,
  "view.formatting": toggleFormattingInGrid,
  "view.privacy": togglePrivacyAction,
  "timing.moveStart.frame.-": () => timingMoveStart("frame", -1),
  "timing.moveStart.frame.+": () => timingMoveStart("frame", 1),
  "timing.moveStart.ms.-": () => timingMoveStart("ms", -1),
  "timing.moveStart.ms.+": () => timingMoveStart("ms", 1),
  "timing.moveStart.custom.-": () => timingMoveStart("custom", -1),
  "timing.moveStart.custom.+": () => timingMoveStart("custom", 1),
  "timing.moveStart.keepGap.frame.-": () => timingMoveStart("frame", -1, "keepGap"),
  "timing.moveStart.keepGap.frame.+": () => timingMoveStart("frame", 1, "keepGap"),
  "timing.moveStart.push.frame.-": () => timingMoveStart("frame", -1, "push"),
  "timing.moveStart.push.frame.+": () => timingMoveStart("frame", 1, "push"),
  "timing.moveEnd.frame.-": () => timingMoveEnd("frame", -1),
  "timing.moveEnd.frame.+": () => timingMoveEnd("frame", 1),
  "timing.moveEnd.ms.-": () => timingMoveEnd("ms", -1),
  "timing.moveEnd.ms.+": () => timingMoveEnd("ms", 1),
  "timing.moveEnd.custom.-": () => timingMoveEnd("custom", -1),
  "timing.moveEnd.custom.+": () => timingMoveEnd("custom", 1),
  "timing.moveEnd.keepGap.frame.-": () => timingMoveEnd("frame", -1, "keepGap"),
  "timing.moveEnd.keepGap.frame.+": () => timingMoveEnd("frame", 1, "keepGap"),
  "timing.moveEnd.push.frame.-": () => timingMoveEnd("frame", -1, "push"),
  "timing.moveEnd.push.frame.+": () => timingMoveEnd("frame", 1, "push"),
  "timing.moveSelected.frame.-": () => timingMoveSelected("frame", -1),
  "timing.moveSelected.frame.+": () => timingMoveSelected("frame", 1),
  "timing.moveSelected.ms.-": () => timingMoveSelected("ms", -1),
  "timing.moveSelected.ms.+": () => timingMoveSelected("ms", 1),
  "timing.moveSelected.custom.-": () => timingMoveSelected("custom", -1),
  "timing.moveSelected.custom.+": () => timingMoveSelected("custom", 1),
  "timing.moveSelectedFollowing.frame.-": () => timingMoveSelected("frame", -1, true),
  "timing.moveSelectedFollowing.frame.+": () => timingMoveSelected("frame", 1, true),
  "timing.moveSelectedFollowing.ms.-": () => timingMoveSelected("ms", -1, true),
  "timing.moveSelectedFollowing.ms.+": () => timingMoveSelected("ms", 1, true),
  "timing.moveAll.frame.-": () => timingMoveAll("frame", -1),
  "timing.moveAll.frame.+": () => timingMoveAll("frame", 1),
  "timing.moveAll.ms.-": () => timingMoveAll("ms", -1),
  "timing.moveAll.ms.+": () => timingMoveAll("ms", 1),
  "timing.moveAll.custom.-": () => timingMoveAll("custom", -1),
  "timing.moveAll.custom.+": () => timingMoveAll("custom", 1),
  "timing.setStart": timingSetStart,
  "timing.setEnd": timingSetEnd,
  "timing.setStartGoNext": timingSetStartGoNext,
  "timing.setEndGoNext": timingSetEndGoNext,
  "timing.setStartKeepDuration": timingSetStartKeepDuration,
  "timing.setStartOffsetRest": timingSetStartOffsetRest,
  "timing.setEndAddNew": timingSetEndAddNew,
  "timing.setEndAndNextAfterGap": timingSetEndAndNextAfterGap,
  "timing.setStartAndPrevMinusGap": timingSetStartAndPrevMinusGap,
  "timing.extendToPrevious": timingExtendToPrevious,
  "timing.extendToNext": timingExtendToNext,
  "timing.extendPreviousEnd": timingExtendPreviousEnd,
  "timing.extendNextStart": timingExtendNextStart,
  "timing.snapAllToFrames": timingSnapAllToFrames,
};

export function runAction(id: string) {
  void ACTIONS[id]?.();
}
