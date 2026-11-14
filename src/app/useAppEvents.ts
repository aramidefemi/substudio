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
  autoBreakAction,
  breakAtFirstSpaceAction,
  copyAction,
  cutAction,
  openFind,
  pasteAction,
  redoAction,
  runAction,
  save,
  selectAllAction,
  timingExtendToNext,
  timingExtendToPrevious,
  timingMoveEnd,
  timingMoveSelected,
  timingMoveStart,
  timingSetEnd,
  timingSetEndAddNew,
  timingSetEndGoNext,
  timingSetStart,
  timingSetStartOffsetRest,
  toggleDialogDashesAction,
  toggleItalicAction,
  toggleLineBreakAction,
  togglePrivacyAction,
  unbreakAction,
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
          // Menu-owned accelerators (incl. timing) are bound only in the browser.
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
                F9: (e: KeyboardEvent) => {
                  e.preventDefault();
                  timingSetStartOffsetRest();
                },
                F10: (e: KeyboardEvent) => {
                  e.preventDefault();
                  timingSetEndGoNext();
                },
                F11: (e: KeyboardEvent) => {
                  e.preventDefault();
                  timingSetStart();
                },
                F12: (e: KeyboardEvent) => {
                  e.preventDefault();
                  timingSetEnd();
                },
                "Shift+F10": (e: KeyboardEvent) => {
                  e.preventDefault();
                  timingSetEndAddNew();
                },
                "Alt+ArrowLeft": outsideFields(() => timingMoveStart("frame", -1)),
                "Alt+ArrowRight": outsideFields(() => timingMoveStart("frame", 1)),
                "Alt+Shift+ArrowLeft": outsideFields(() => timingMoveEnd("frame", -1)),
                "Alt+Shift+ArrowRight": outsideFields(() => timingMoveEnd("frame", 1)),
                "Alt+$mod+ArrowLeft": outsideFields(() => timingMoveSelected("frame", -1)),
                "Alt+$mod+ArrowRight": outsideFields(() => timingMoveSelected("frame", 1)),
                "Alt+Shift+KeyE": (e: KeyboardEvent) => {
                  e.preventDefault();
                  timingExtendToPrevious();
                },
                "$mod+Shift+KeyE": (e: KeyboardEvent) => {
                  e.preventDefault();
                  timingExtendToNext();
                },
                "$mod+KeyI": (e: KeyboardEvent) => {
                  e.preventDefault();
                  toggleItalicAction();
                },
                "$mod+KeyR": (e: KeyboardEvent) => {
                  e.preventDefault();
                  autoBreakAction();
                },
                "$mod+Shift+KeyR": (e: KeyboardEvent) => {
                  e.preventDefault();
                  unbreakAction();
                },
                "$mod+Shift+KeyL": (e: KeyboardEvent) => {
                  e.preventDefault();
                  toggleLineBreakAction();
                },
                "$mod+Shift+KeyD": (e: KeyboardEvent) => {
                  e.preventDefault();
                  toggleDialogDashesAction();
                },
                "$mod+Alt+Enter": (e: KeyboardEvent) => {
                  e.preventDefault();
                  breakAtFirstSpaceAction();
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
