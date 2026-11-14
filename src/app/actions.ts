import { ask, open, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { create } from "zustand";
import { clock } from "@/features/playback/clock";
import { setDensity, setTheme } from "@/features/settings/store";
import {
  insertCue,
  loadDocument,
  markSaved,
  newDocument,
  redo,
  setVideo,
  toggleTimecode,
  undo,
  useSubtitles,
} from "@/features/subtitles/store";
import type { SubtitleFormat } from "@/features/subtitles/types";
import { commands, fileName, inTauri, stripExtension } from "@/lib/tauri";

/** Transient UI state that several components toggle. */
export const useUi = create<{ findOpen: boolean }>()(() => ({ findOpen: false }));

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

export async function newFile() {
  if (await confirmDiscard()) newDocument();
}

export async function openSubtitles() {
  if (!inTauri) return desktopOnly();
  if (!(await confirmDiscard())) return;
  const path = await open({ filters: [SUBTITLE_FILTER] });
  if (!path) return;
  try {
    const cues = await commands.readSubtitles(path);
    loadDocument(cues, path);
    toast.success(`Opened ${fileName(path)}`, { description: `${cues.length} subtitles` });
  } catch (err) {
    toast.error(`Could not open ${fileName(path)}`, { description: String(err) });
  }
}

export async function openVideo() {
  if (!inTauri) return desktopOnly();
  const path = await open({ filters: [VIDEO_FILTER] });
  if (path) setVideo(path);
}

async function writeTo(path: string, format: SubtitleFormat) {
  try {
    await commands.writeSubtitles(path, useSubtitles.getState().cues, format);
    markSaved(path);
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
  await writeTo(filePath, filePath.toLowerCase().endsWith(".vtt") ? "vtt" : "srt");
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
export const addCueAtPlayhead = () => insertCue(clock.time);

/** Ids match the native menu items in `src-tauri/src/menu.rs`. */
const ACTIONS: Record<string, () => unknown> = {
  "file.new": newFile,
  "file.open": openSubtitles,
  "file.openVideo": openVideo,
  "file.save": save,
  "file.saveAs": () => saveAs("srt"),
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
