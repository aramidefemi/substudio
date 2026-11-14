import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { tinykeys } from "tinykeys";
import { clock } from "@/features/playback/clock";
import { useSettings } from "@/features/settings/store";
import { cueIndexAt, select, selectRelative, useSubtitles } from "@/features/subtitles/store";
import { focusCueText, isEditable } from "@/lib/dom";
import { fileName, inTauri } from "@/lib/tauri";
import {
  copyAction,
  cutAction,
  openFind,
  pasteAction,
  redoAction,
  runAction,
  save,
  selectAllAction,
  togglePrivacyAction,
  undoAction,
} from "./actions";

/** Wraps a handler so it only fires when the user isn't typing or on a button. */
const outsideFields = (fn: () => void) => (e: KeyboardEvent) => {
  if (isEditable(e.target) || e.target instanceof HTMLButtonElement) return;
  e.preventDefault();
  fn();
};

function windowTitle(filePath: string | null, dirty: boolean, privacy: string): string {
  const hideNames = privacy === "names" || privacy === "text";
  const name = hideNames ? "••••" : filePath ? fileName(filePath) : "Untitled";
  return `${name}${dirty ? " •" : ""} — Substudio`;
}

/** Native menu events, keyboard shortcuts, window title and play-follow selection. */
export function useAppEvents() {
  useEffect(() => {
    if (!inTauri) return;
    const unlisten = listen<string>("menu", (e) => runAction(e.payload));
    return () => void unlisten.then((fn) => fn());
  }, []);

  useEffect(
    () =>
      tinykeys(
        window,
        {
          Space: outsideFields(() => clock.toggle()),
          ArrowDown: outsideFields(() => selectRelative(1)),
          ArrowUp: outsideFields(() => selectRelative(-1)),
          Enter: outsideFields(focusCueText),
          "$mod+KeyK": (e) => {
            e.preventDefault();
            openFind();
          },
          "$mod+Shift+KeyP": (e) => {
            e.preventDefault();
            togglePrivacyAction();
          },
          // Clipboard / select-all: custom handlers decide text vs grid.
          "$mod+KeyC": (e) => {
            if (isEditable(e.target)) return;
            e.preventDefault();
            void copyAction();
          },
          "$mod+KeyX": (e) => {
            if (isEditable(e.target)) return;
            e.preventDefault();
            void cutAction();
          },
          "$mod+KeyV": (e) => {
            if (isEditable(e.target)) return;
            e.preventDefault();
            void pasteAction();
          },
          "$mod+KeyA": (e) => {
            if (isEditable(e.target)) return;
            e.preventDefault();
            selectAllAction();
          },
          // In the desktop app these come from the native menu accelerators.
          ...(inTauri
            ? {}
            : {
                "$mod+KeyS": (e: KeyboardEvent) => {
                  e.preventDefault();
                  void save();
                },
                "$mod+KeyF": (e: KeyboardEvent) => {
                  e.preventDefault();
                  openFind();
                },
                "$mod+KeyZ": (e: KeyboardEvent) => {
                  e.preventDefault();
                  undoAction();
                },
                "$mod+Shift+KeyZ": (e: KeyboardEvent) => {
                  e.preventDefault();
                  redoAction();
                },
              }),
        },
        // Let our own filter decide; tinykeys would otherwise drop every event from inputs.
        { ignore: () => false },
      ),
    [],
  );

  useEffect(() => {
    const sync = () => {
      const s = useSubtitles.getState();
      const privacy = useSettings.getState().privacy;
      const title = windowTitle(s.filePath, s.dirty, privacy);
      if (inTauri) void getCurrentWindow().setTitle(title);
      else document.title = title;
    };
    sync();
    const unsubs = [useSubtitles.subscribe(sync), useSettings.subscribe(sync)];
    return () => unsubs.forEach((u) => u());
  }, []);

  // While playing, select the cue under the playhead (unless she's typing).
  useEffect(
    () =>
      clock.onTick(() => {
        if (!clock.playing || isEditable(document.activeElement)) return;
        const { cues, selectedId } = useSubtitles.getState();
        const cue = cues[cueIndexAt(cues, clock.time)];
        if (cue && cue.id !== selectedId) select(cue.id);
      }),
    [],
  );

  // Keep the simulated timeline long enough for the document.
  useEffect(() => {
    const sync = () => clock.setFallbackDuration((useSubtitles.getState().cues.at(-1)?.end ?? 0) + 10);
    sync();
    return useSubtitles.subscribe(sync);
  }, []);
}
