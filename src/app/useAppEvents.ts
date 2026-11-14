import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { tinykeys } from "tinykeys";
import { clock } from "@/features/playback/clock";
import { cueIndexAt, select, selectRelative, useSubtitles } from "@/features/subtitles/store";
import { focusCueText, isEditable } from "@/lib/dom";
import { fileName, inTauri } from "@/lib/tauri";
import { openFind, redoAction, runAction, save, undoAction } from "./actions";

/** Wraps a handler so it only fires when the user isn't typing or on a button. */
const outsideFields = (fn: () => void) => (e: KeyboardEvent) => {
  if (isEditable(e.target) || e.target instanceof HTMLButtonElement) return;
  e.preventDefault();
  fn();
};

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

  useEffect(
    () =>
      useSubtitles.subscribe((s, prev) => {
        if (s.filePath === prev.filePath && s.dirty === prev.dirty) return;
        const title = `${s.filePath ? fileName(s.filePath) : "Untitled"}${s.dirty ? " •" : ""} — Substudio`;
        if (inTauri) void getCurrentWindow().setTitle(title);
        else document.title = title;
      }),
    [],
  );

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
