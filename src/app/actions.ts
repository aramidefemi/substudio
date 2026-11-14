import { ask, open, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { create } from "zustand";
import { clock } from "@/features/playback/clock";
import {
  clearRecent,
  pushRecentSubtitle,
  pushRecentVideo,
  setDensity,
  setTheme,
  useSettings,
} from "@/features/settings/store";
import {
  insertCue,
  loadDocument,
  markSaved,
  newDocument,
  redo,
  setKnownMtime,
  setVideo,
  toggleTimecode,
  undo,
  useSubtitles,
} from "@/features/subtitles/store";
import type { SubtitleFormat } from "@/features/subtitles/types";
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
  "edit.find": openFind,
  "view.theme.system": () => setTheme("system"),
  "view.theme.light": () => setTheme("light"),
  "view.theme.dark": () => setTheme("dark"),
  "view.density.compact": () => setDensity("compact"),
  "view.density.comfortable": () => setDensity("comfortable"),
  "view.timecode": toggleTimecode,
};

export function runAction(id: string) {
  void ACTIONS[id]?.();
}
