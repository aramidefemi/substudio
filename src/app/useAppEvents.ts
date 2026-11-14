import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { clock } from "@/features/playback/clock";
import { useSettings } from "@/features/settings/store";
import { cueIndexAt, select, useSubtitles } from "@/features/subtitles/store";
import { isEditable } from "@/lib/dom";
import { fileName, inTauri } from "@/lib/tauri";
import { installNativeMenu } from "./commands/menu";
import { runCommand } from "./commands/registry";
import { bindShortcuts } from "./commands/shortcuts";

function windowTitle(filePath: string | null, dirty: boolean, privacy: string): string {
  const hideNames = privacy === "names" || privacy === "text";
  const name = hideNames ? "••••" : filePath ? fileName(filePath) : "Untitled";
  return `${name}${dirty ? " •" : ""} — Substudio`;
}

/** Native menu, keyboard shortcuts (both from the command registry), window title and play-follow selection. */
export function useAppEvents() {
  useEffect(() => {
    if (!inTauri) return;
    const unlisten = listen<string>("menu", (e) => runCommand(e.payload));
    return () => void unlisten.then((fn) => fn());
  }, []);

  // Native menu bar from the command registry, plus page-level shortcuts.
  useEffect(() => {
    void installNativeMenu().catch((err) => console.error("Could not build the menu bar", err));
    return bindShortcuts();
  }, []);

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
