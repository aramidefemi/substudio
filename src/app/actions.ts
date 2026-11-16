import { Channel } from "@tauri-apps/api/core";
import { ask, open, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { create } from "zustand";
import { burnedName, EXPORT_CANCELLED, percent, withMp4 } from "@/features/export/burn";
import { codecLabel, EMBED_EXTENSIONS, embeddedName, withEmbedExt } from "@/features/export/embed";
import { nextShot, previousShot, toggleShotAt } from "@/features/media/shotChanges";
import {
  generateShotChanges,
  preferAudioTrack,
  restoreShotChanges,
  setShotChanges,
  useMedia,
} from "@/features/media/store";
import { actionTime } from "@/features/waveform/context";
import { clock } from "@/features/playback/clock";
import { playNeighbour } from "@/features/playback/transport";
import {
  clearRecent,
  cyclePrivacy,
  pushRecentSubtitle,
  pushRecentVideo,
  setShowCpsColumn,
  setShowFormattingInGrid,
  setShowGapColumn,
  setShowOriginalColumn,
  useSettings,
} from "@/features/settings/store";
import { getRules } from "@/features/subtitles/activeRules";
import { nextBookmarkIndex } from "@/features/subtitles/bookmarks";
import { parseCues, serializeCues } from "@/features/subtitles/clipboard";
import { toggleItalic } from "@/features/subtitles/format";
import { findEmpty, findError, lineFromVideo } from "@/features/subtitles/navigation";
import { plainTextLines } from "@/features/subtitles/plainText";
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
  applyOriginals,
  clearOriginals,
  insertPlainText,
  pasteCues,
  redo,
  removeBlankLines,
  removeCues,
  replaceWithPlainText,
  restoreBookmarks,
  restoreOriginals,
  rippleDeleteSelected,
  select,
  selectAll,
  selectRelative,
  selectedCues,
  setEndAddNewAndGoToNew,
  setEndAndGoToNext,
  setEndAndStartOfNextAfterGap,
  setKnownMtime,
  setPairTexts,
  setSelectedEndAt,
  setSelectedStartAt,
  setStartAndEndOfPreviousMinusGap,
  setStartAndGoToNext,
  setVideo,
  snapAllTimesToFrames,
  snapSelectedToShotChanges,
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
  moveFirstWordUp,
  moveLastWordDown,
  moveTextFromCursorDown,
  unbreak,
  type TextPair,
} from "@/features/subtitles/textOps";
import type { AssStyle, CueData, SubtitleFormat } from "@/features/subtitles/types";
import { cueTextSelection, focusCueText, isEditable, setCueTextSelection } from "@/lib/dom";
import { commands, fileName, inTauri, parentDir, stripExtension } from "@/lib/tauri";
import { planDrop, SUBTITLE_EXTENSIONS, VIDEO_EXTENSIONS } from "./drop";
import { restoreProject } from "./project";
import { applyProjectProfile, currentProject } from "./ruleProfiles";

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
  fixCommonOpen: boolean;
  beautifyOpen: boolean;
  spellOpen: boolean;
  multipleReplaceOpen: boolean;
  toolsOpen: boolean;
  removeHiOpen: boolean;
  customTextExportOpen: boolean;
  batchConvertOpen: boolean;
  shortcutsOpen: boolean;
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
  fixCommonOpen: false,
  beautifyOpen: false,
  spellOpen: false,
  multipleReplaceOpen: false,
  toolsOpen: false,
  removeHiOpen: false,
  customTextExportOpen: false,
  batchConvertOpen: false,
  shortcutsOpen: false,
}));

const SUBTITLE_FILTER = { name: "Subtitles", extensions: SUBTITLE_EXTENSIONS };
const VIDEO_FILTER = { name: "Video", extensions: VIDEO_EXTENSIONS };
const PLAIN_TEXT_FILTER = { name: "Plain text", extensions: ["txt", "text"] };

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
  const lower = path.toLowerCase();
  if (lower.endsWith(".vtt")) return "vtt";
  if (lower.endsWith(".ass")) return "ass";
  if (lower.endsWith(".ssa")) return "ssa";
  if (lower.endsWith(".sbv")) return "sbv";
  if (lower.endsWith(".ttml")) return "ttml";
  if (lower.endsWith(".dfxp")) return "dfxp";
  return "srt";
}

const FORMAT_FILTER: Record<SubtitleFormat, { name: string; extensions: string[] }> = {
  srt: { name: "SubRip", extensions: ["srt"] },
  vtt: { name: "WebVTT", extensions: ["vtt"] },
  ass: { name: "Advanced SubStation Alpha", extensions: ["ass"] },
  ssa: { name: "SubStation Alpha", extensions: ["ssa"] },
  sbv: { name: "YouTube SBV", extensions: ["sbv"] },
  ttml: { name: "TTML", extensions: ["ttml"] },
  dfxp: { name: "DFXP", extensions: ["dfxp"] },
};

function stylesForWrite(format: SubtitleFormat): AssStyle[] | null {
  if (format !== "ass" && format !== "ssa") return null;
  return useSubtitles.getState().assStyles;
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

/**
 * Restores video, fps, timecode, rule profile, bookmarks, originals and the last selected line.
 * Missing or bad sidecar: only the rule profile falls back to the last chosen one.
 */
async function applySidecar(path: string) {
  let file;
  try {
    file = await commands.readProject(path);
  } catch {
    file = null;
  }
  if (!file) return applyProjectProfile(null);
  const s = useSubtitles.getState();
  const p = restoreProject(s.cues, file);
  applyProjectProfile(p.ruleProfile);
  restoreBookmarks(p.bookmarks);
  restoreOriginals(p.originals, p.originalPath);
  if (p.originals.size) setShowOriginalColumn(true);
  if (p.fps || p.timecode) {
    useSubtitles.setState({ ...(p.fps ? { fps: p.fps } : {}), ...(p.timecode ? { timecode: p.timecode } : {}) });
  }
  let videoSet = false;
  if (p.videoPath && !s.videoPath) {
    try {
      await commands.fileMtime(p.videoPath); // exists?
      preferAudioTrack(p.videoPath, p.audioTrack);
      setVideo(p.videoPath);
      pushRecentVideo(p.videoPath);
      videoSet = true;
    } catch {
      toast("Video not found", { description: `${fileName(p.videoPath)} — open it again with ⇧⌘O.` });
    }
  } else if (p.audioTrack != null) {
    preferAudioTrack(s.videoPath ?? p.videoPath, p.audioTrack);
  }
  // After setVideo (which clears shots); session+sidecar persistence for SYN-04.
  restoreShotChanges(p.shotChanges);
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
    await commands.writeProject(path, currentProject());
  } catch (err) {
    console.warn("Could not write the project sidecar", err);
  }
}

async function openSubtitlePath(path: string, keepVideo: boolean, encoding?: string) {
  const read = encoding
    ? await commands.readSubtitlesEncoded(path, encoding)
    : await commands.readSubtitlesDetect(path);
  const cues = read.cues;
  const styles = read.styles ?? null;
  // Path extension wins when content didn't mark ASS/SSA.
  const pathFmt = formatOf(path);
  const assKind =
    read.assKind ?? (pathFmt === "ass" || pathFmt === "ssa" ? pathFmt : null);
  const detected = !encoding && read.encoding !== "utf-8" ? read.encoding : null;
  loadDocument(cues, path, keepVideo, { styles, kind: assKind });
  await rememberMtime(path);
  await applySidecar(path);
  pushRecentSubtitle(path, useSubtitles.getState().videoPath);
  const styleNote = styles?.length ? ` · ${styles.length} style${styles.length === 1 ? "" : "s"}` : "";
  toast.success(`Opened ${fileName(path)}`, {
    description: detected
      ? `${cues.length} subtitles${styleNote} · read as ${detected}, saves as UTF-8. Wrong characters? Use Import with encoding.`
      : `${cues.length} subtitles${styleNote}`,
  });
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
    toast.error("Can't open this file", {
      description: "Drop a .srt, .vtt, .ass, .ssa, .sbv, .ttml or .dfxp subtitle, or an .mp4, .mov, .m4v or .webm video.",
    });
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
    const { cues } = useSubtitles.getState();
    await commands.writeSubtitles(path, cues, format, stylesForWrite(format));
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
    filters: [FORMAT_FILTER[format]],
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
      const fmt = formatOf(filePath);
      await commands.writeSubtitles(filePath, cues, fmt, stylesForWrite(fmt));
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
export const openFixCommon = () => useUi.setState({ fixCommonOpen: true });
export const openBeautify = () => useUi.setState({ beautifyOpen: true });
export const openSpellCheck = () => {
  useUi.setState({ spellOpen: true });
  void import("@/features/spellcheck/session").then((m) => m.runSpellSession());
};
export const openMultipleReplace = () => useUi.setState({ multipleReplaceOpen: true });
export const openTextTools = () => useUi.setState({ toolsOpen: true });
export const openRemoveHi = () => useUi.setState({ removeHiOpen: true });
export const openCustomTextExport = () => useUi.setState({ customTextExportOpen: true });
export const openBatchConvert = () => useUi.setState({ batchConvertOpen: true });
export const openMediaInfo = () => {
  if (!useSubtitles.getState().videoPath) {
    toast("No video open", { description: "Open a video to see media information." });
    return;
  }
  useUi.setState({ mediaInfoOpen: true });
};
export const openHistory = () => useUi.setState({ historyOpen: true });
export const openCommandPalette = () => useUi.setState({ paletteOpen: true });
export const openShortcuts = () => useUi.setState({ shortcutsOpen: true });
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
    filters: [FORMAT_FILTER[format]],
  });
  if (!path) return;
  try {
    await commands.writeSubtitles(path, cues, format, stylesForWrite(format));
    toast.success(`Saved ${cues.length} line${cues.length === 1 ? "" : "s"}`, {
      description: fileName(path),
    });
  } catch (err) {
    toast.error("Could not save selection", { description: String(err) });
  }
}

interface VideoExport {
  id: string;
  title: string;
  extensions: string[];
  defaultName: (videoPath: string) => string;
  withExt: (picked: string, videoPath: string) => string;
  busy: (dest: string) => string;
  failed: string;
  cancelled: string;
  run: (dest: string, onProgress: Channel<number>) => Promise<{ path: string; detail: string }>;
}

/** Save dialog → progress toast with Cancel → result toast. The source is never modified. */
async function exportVideo(o: VideoExport) {
  if (!inTauri) return desktopOnly();
  const { videoPath, cues } = useSubtitles.getState();
  if (!videoPath || !cues.length) {
    toast(`Nothing to ${o.id}`, { description: "Open a video and add subtitles first." });
    return;
  }
  const picked = await saveDialog({
    title: o.title,
    defaultPath: `${parentDir(videoPath)}/${o.defaultName(videoPath)}`,
    filters: [{ name: "Video", extensions: o.extensions }],
  });
  if (!picked) return;
  const dest = o.withExt(picked, videoPath);
  const show = (p: number) =>
    toast.loading(o.busy(fileName(dest)), {
      id: o.id,
      description: percent(p),
      duration: Infinity,
      action: { label: "Cancel", onClick: () => void commands.cancelExport() },
    });
  show(0);
  const onProgress = new Channel<number>();
  onProgress.onmessage = show;
  try {
    const { path, detail } = await o.run(dest, onProgress);
    toast.success(`Saved ${fileName(path)}`, {
      id: o.id,
      description: detail,
      duration: 8000,
      action: { label: "Show", onClick: () => void commands.revealPath(path) },
    });
  } catch (err) {
    const msg = String(err);
    if (msg === EXPORT_CANCELLED) toast(o.cancelled, { id: o.id, duration: 4000 });
    else toast.error(o.failed, { id: o.id, description: msg, duration: Infinity, closeButton: true });
  }
}

/** Burn the cues into a new MP4 next to the video (DLV-01). */
export const burnIntoVideo = () =>
  exportVideo({
    id: "burn",
    title: "Burn subtitles into video",
    extensions: ["mp4"],
    defaultName: burnedName,
    withExt: withMp4,
    busy: (name) => `Burning subtitles into ${name}…`,
    failed: "Could not burn subtitles",
    cancelled: "Burn-in cancelled",
    run: async (dest, onProgress) => {
      const { videoPath, cues, assStyles } = useSubtitles.getState();
      const { path, encoder } = await commands.burnSubtitles(videoPath!, dest, cues, assStyles, onProgress);
      return { path, detail: encoder === "libx264" ? "Encoded with x264" : "Hardware encoded" };
    },
  });

/** Embed the cues as a soft subtitle track in a new MP4/MOV/MKV; video and audio are copied (DLV-02). */
export const embedSubtitles = () =>
  exportVideo({
    id: "embed",
    title: "Embed subtitles into video",
    extensions: [...EMBED_EXTENSIONS],
    defaultName: embeddedName,
    withExt: withEmbedExt,
    busy: (name) => `Embedding subtitles into ${name}…`,
    failed: "Could not embed subtitles",
    cancelled: "Embed cancelled",
    run: async (dest, onProgress) => {
      const { videoPath, cues, assStyles } = useSubtitles.getState();
      const { path, codec } = await commands.embedSubtitles(videoPath!, dest, cues, assStyles, onProgress);
      return { path, detail: `Added a ${codecLabel(codec)}` };
    },
  });

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

/** FIL-07: open an SRT/VTT (or plain text) as the original/script column, paired by index. */
export async function openOriginalSubtitles() {
  if (!inTauri) return desktopOnly();
  if (!useSubtitles.getState().cues.length) {
    toast("Open a translation first", { description: "The original column pairs onto existing lines by index." });
    return;
  }
  const path = await open({
    filters: [
      { name: "Subtitles or text", extensions: [...SUBTITLE_EXTENSIONS, "txt", "text"] },
      SUBTITLE_FILTER,
      PLAIN_TEXT_FILTER,
    ],
    title: "Open original / script",
  });
  if (!path) return;
  try {
    const lower = path.toLowerCase();
    let lines: string[];
    if (lower.endsWith(".txt") || lower.endsWith(".text")) {
      lines = plainTextLines(await commands.readTextFile(path));
    } else {
      const read = await commands.readSubtitlesDetect(path);
      lines = read.cues.map((c) => c.text);
    }
    if (!lines.length) {
      toast("No lines found", { description: fileName(path) });
      return;
    }
    const cueCount = useSubtitles.getState().cues.length;
    applyOriginals(lines, path);
    setShowOriginalColumn(true);
    const paired = Math.min(lines.length, cueCount);
    const extra =
      lines.length > cueCount
        ? ` · ${lines.length - cueCount} script line${lines.length - cueCount === 1 ? "" : "s"} unused`
        : cueCount > lines.length
          ? ` · ${cueCount - lines.length} cue${cueCount - lines.length === 1 ? "" : "s"} without original`
          : "";
    toast.success(`Opened original (${paired} paired)`, {
      description: `${fileName(path)}${extra}`,
    });
  } catch (err) {
    toast.error("Could not open original", { description: String(err) });
  }
}

/** FIL-07: paste clipboard lines into the original column by index. */
export async function pasteOriginalAction() {
  try {
    const text = await readClipboard();
    const lines = plainTextLines(text);
    if (!lines.length) {
      toast("Clipboard has no lines");
      return;
    }
    if (!useSubtitles.getState().cues.length) {
      toast("Open a translation first", { description: "Paste original lines onto existing cues." });
      return;
    }
    applyOriginals(lines, null);
    setShowOriginalColumn(true);
    toast.success(`Pasted ${Math.min(lines.length, useSubtitles.getState().cues.length)} original line${lines.length === 1 ? "" : "s"}`);
  } catch (err) {
    toast.error("Could not paste original", { description: String(err) });
  }
}

export function closeOriginalAction() {
  clearOriginals();
  toast("Closed original");
}

/** SCR-01: File → Import plain text… — replace document with untimed lines. */
export async function importPlainTextFile() {
  if (!inTauri) return desktopOnly();
  if (!(await confirmDiscard())) return;
  const path = await open({ filters: [PLAIN_TEXT_FILTER], title: "Import plain text" });
  if (!path) return;
  try {
    const text = await commands.readTextFile(path);
    const n = replaceWithPlainText(text, true);
    setKnownMtime(null);
    if (!n) {
      toast("No lines found", { description: "The file had no non-empty lines." });
      return;
    }
    toast.success(`Imported ${n} untimed line${n === 1 ? "" : "s"}`, {
      description: `${fileName(path)} — time them with Set start / Set end or Hold to time`,
    });
  } catch (err) {
    toast.error("Could not import plain text", { description: String(err) });
  }
}

/** SCR-01: Edit → Paste plain text — clipboard lines → untimed cues (replace if empty). */
export async function pastePlainTextAction() {
  if (isEditable(document.activeElement)) {
    document.execCommand("paste");
    return;
  }
  try {
    const text = await readClipboard();
    if (!text.trim()) {
      toast("Clipboard is empty");
      return;
    }
    const empty = useSubtitles.getState().cues.length === 0;
    const n = empty ? replaceWithPlainText(text, true) : insertPlainText(text);
    if (!n) {
      toast("No lines found", { description: "Clipboard had no non-empty lines." });
      return;
    }
    toast.success(
      empty
        ? `Imported ${n} untimed line${n === 1 ? "" : "s"}`
        : `Added ${n} untimed line${n === 1 ? "" : "s"}`,
    );
  } catch (err) {
    toast.error("Could not paste plain text", { description: String(err) });
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

export function toggleOriginalColumn() {
  const next = !useSettings.getState().showOriginalColumn;
  setShowOriginalColumn(next);
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

/* ---------- shot changes (SYN-04) ---------- */

export async function syncGenerateShotChanges() {
  const path = useSubtitles.getState().videoPath;
  const n = await generateShotChanges(path);
  if (n >= 0 && useSubtitles.getState().filePath) {
    // Persist to sidecar so reopen keeps markers (session + sidecar).
    try {
      await commands.writeProject(useSubtitles.getState().filePath!, currentProject());
    } catch (err) {
      console.warn("Could not write shot changes to sidecar", err);
    }
  }
}

export function syncShotChangeNext() {
  const shots = useMedia.getState().shotChanges;
  const t = nextShot(shots, clock.time);
  if (t == null) {
    toast(shots?.length ? "No shot change ahead" : "Generate shot changes first");
    return;
  }
  clock.seek(t);
}

export function syncShotChangePrevious() {
  const shots = useMedia.getState().shotChanges;
  const t = previousShot(shots, clock.time);
  if (t == null) {
    toast(shots?.length ? "No shot change before the playhead" : "Generate shot changes first");
    return;
  }
  clock.seek(t);
}

export function syncSnapToShotChanges() {
  if (!useMedia.getState().shotChanges?.length) {
    toast("Generate shot changes first");
    return;
  }
  const n = snapSelectedToShotChanges();
  toast(n ? `Snapped ${n} line${n === 1 ? "" : "s"} to shot changes` : "Nothing to snap");
}

/** Add/remove a shot marker at the waveform right-click (or playhead). Persists to sidecar; not document-undoable (same as generate). */
export async function syncToggleShotAt() {
  const t = actionTime();
  const { next, added } = toggleShotAt(useMedia.getState().shotChanges, t);
  setShotChanges(next);
  toast(added ? "Shot change added" : "Shot change removed");
  const path = useSubtitles.getState().filePath;
  if (path) {
    try {
      await commands.writeProject(path, currentProject());
    } catch (err) {
      console.warn("Could not write shot changes to sidecar", err);
    }
  }
}

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
  const max = getRules().maxLineLength;
  mapSelectedTexts((t) => autoBreak(t, max));
}

export function balanceLinesAction() {
  const max = getRules().maxLineLength;
  mapSelectedTexts((t) => balanceLines(t, max));
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

/* ---------- go to (NAV-01) ---------- */

function goToIndex(i: number, none: string) {
  const cue = useSubtitles.getState().cues[i];
  if (!cue) {
    toast(none);
    return;
  }
  select(cue.id);
  clock.seek(cue.start);
}

const selectedIndex = () => {
  const s = useSubtitles.getState();
  return s.cues.findIndex((c) => c.id === s.selectedId);
};

export function goToError(dir: 1 | -1) {
  goToIndex(findError(useSubtitles.getState().cues, selectedIndex(), dir, getRules()), dir > 0 ? "No more errors below" : "No more errors above");
}

export function goToNextEmpty() {
  goToIndex(findEmpty(useSubtitles.getState().cues, selectedIndex()), "No more empty lines below");
}

export function goToLineFromVideo(dir: 1 | -1) {
  goToIndex(lineFromVideo(useSubtitles.getState().cues, clock.time, dir), dir > 0 ? "No line after the playhead" : "No line before the playhead");
}

/* ---------- move words between lines (EDT-11) ---------- */

/** Apply a word move to the primary line and the next; keeps the caret at the end of the primary line's text. */
function moveWords(fn: (first: string, second: string) => TextPair | null): boolean {
  const s = useSubtitles.getState();
  const i = s.cues.findIndex((c) => c.id === s.selectedId);
  const cur = s.cues[i];
  const next = s.cues[i + 1];
  if (!cur || !next) {
    toast("No next line");
    return false;
  }
  const focused = cueTextSelection() !== null;
  const pair = fn(cur.text, next.text);
  if (!pair) return false;
  setPairTexts(i, pair.first, pair.second);
  if (focused) requestAnimationFrame(() => setCueTextSelection(pair.first.length));
  return true;
}

export const moveFirstWordFromNextAction = () => void moveWords(moveFirstWordUp);
export const moveLastWordToNextAction = () => void moveWords(moveLastWordDown);

/** Text after the caret moves to the start of the next line; with `play`, go to that line and play it. */
export function moveTextFromCursorToNextAction(play = false) {
  const sel = cueTextSelection();
  if (!sel) {
    toast("Put the cursor in the text box first");
    return;
  }
  if (!moveWords((first, second) => moveTextFromCursorDown(first, sel.start, second))) return;
  if (play && playNeighbour(1)) requestAnimationFrame(() => setCueTextSelection(0));
}
