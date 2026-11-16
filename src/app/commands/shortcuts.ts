import { tinykeys, type KeybindingsMap } from "tinykeys";
import { isEditable } from "@/lib/dom";
import { inTauri } from "@/lib/tauri";
import { menuCommandIds } from "./menu";
import { allCommands, type Command } from "./registry";

/** Focus targets that use plain keys themselves (text, buttons, sliders, open lists and menus). */
const KEY_OWNER_ROLES = '[role="slider"],[role="listbox"],[role="option"],[role="menu"],[role="menuitem"],[role="combobox"]';

/** When true, page shortcuts stay quiet (shortcut capture in settings). */
let suppressed = false;
export const setShortcutsSuppressed = (value: boolean) => {
  suppressed = value;
};

function ownsKeys(target: EventTarget | null): boolean {
  if (isEditable(target) || target instanceof HTMLButtonElement) return true;
  return target instanceof Element && target.closest(KEY_OWNER_ROLES) !== null;
}

/**
 * Binds every command's keys in the page, except the ones the native menu
 * already owns (a global command's first key, when it is in the menu bar,
 * in the desktop app). Returns an unsubscribe function.
 */
export function bindShortcuts(target: Window = window): () => void {
  const nativeOwned = inTauri ? menuCommandIds() : new Set<string>();
  const map: KeybindingsMap = {};
  /** Physical key (`KeyboardEvent.code`) → command waiting for that key's release. */
  const held = new Map<string, Command>();

  for (const command of allCommands()) {
    (command.keys ?? []).forEach((key, i) => {
      const scope = command.scope ?? "global";
      if (scope === "global" && i === 0 && nativeOwned.has(command.id)) return;
      if (map[key]) {
        console.warn(`Shortcut ${key} is bound twice; keeping the first.`);
        return;
      }
      map[key] = (e: KeyboardEvent) => {
        if (suppressed) return;
        if (scope === "outsideText" && ownsKeys(e.target)) return;
        e.preventDefault();
        if (command.release) {
          if (e.repeat || held.has(e.code)) return;
          held.set(e.code, command);
        }
        void command.run();
      };
    });
  }

  // Release by physical key, whatever the modifiers or focus are by then.
  const onKeyUp = (e: KeyboardEvent) => {
    const command = held.get(e.code);
    if (!command) return;
    held.delete(e.code);
    e.preventDefault();
    void command.release?.();
  };
  // Switching apps mid-hold never delivers the keyup: release everything.
  const releaseAll = () => {
    const pending = [...held.values()];
    held.clear();
    pending.forEach((c) => void c.release?.());
  };
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", releaseAll);

  // Our own scope check decides; tinykeys would otherwise drop all events from inputs.
  const unbind = tinykeys(target, map, { ignore: () => false });
  return () => {
    unbind();
    target.removeEventListener("keyup", onKeyUp);
    target.removeEventListener("blur", releaseAll);
  };
}
