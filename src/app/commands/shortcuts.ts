import { tinykeys, type KeybindingsMap } from "tinykeys";
import { isEditable } from "@/lib/dom";
import { inTauri } from "@/lib/tauri";
import { menuCommandIds } from "./menu";
import { allCommands } from "./registry";

/**
 * Binds every command's keys in the page, except the ones the native menu
 * already owns (a global command's first key, when it is in the menu bar,
 * in the desktop app). Returns an unsubscribe function.
 */
export function bindShortcuts(target: Window = window): () => void {
  const nativeOwned = inTauri ? menuCommandIds() : new Set<string>();
  const map: KeybindingsMap = {};

  for (const command of allCommands()) {
    (command.keys ?? []).forEach((key, i) => {
      const scope = command.scope ?? "global";
      if (scope === "global" && i === 0 && nativeOwned.has(command.id)) return;
      if (map[key]) {
        console.warn(`Shortcut ${key} is bound twice; keeping the first.`);
        return;
      }
      map[key] = (e: KeyboardEvent) => {
        if (scope === "outsideText" && (isEditable(e.target) || e.target instanceof HTMLButtonElement)) return;
        e.preventDefault();
        void command.run();
      };
    });
  }

  // Our own scope check decides; tinykeys would otherwise drop all events from inputs.
  return tinykeys(target, map, { ignore: () => false });
}
