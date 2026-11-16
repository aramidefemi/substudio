import { formatShortcut } from "./keys";

/**
 * Where a command's shortcut may fire.
 * - `global`: everywhere, including while typing (⌘S, ⌘Z, F10…). Shown as a
 *   native menu accelerator when the command is in the menu bar.
 * - `outsideText`: only when focus is not in a text field (Space, arrows,
 *   ⌥←…), so it never steals text-editing keys. Never a native accelerator,
 *   because native accelerators can't see focus.
 */
export type CommandScope = "global" | "outsideText";

export interface Command {
  /** Stable id; also the native menu item id. */
  id: string;
  /** Menu and palette label. */
  label: string;
  /** Palette grouping, e.g. "File", "Timing". */
  group: string;
  /** Shortcuts in tinykeys syntax; the first is the one displayed. */
  keys?: string[];
  scope?: CommandScope;
  /** Hide from the command palette (e.g. plain navigation keys). */
  hidden?: boolean;
  run: () => unknown;
  /**
   * Called when the shortcut key that ran the command is released (hold-to-time).
   * Key repeat is ignored while held. Give such commands scope `outsideText`;
   * from the menu or palette only `run` happens.
   */
  release?: () => unknown;
}

const commands = new Map<string, Command>();
/** Substudio defaults captured at registration; `keys` on the command may be overridden. */
const defaultKeys = new Map<string, string[] | undefined>();

export function defineCommands(list: Command[]) {
  for (const c of list) {
    if (commands.has(c.id)) throw new Error(`Duplicate command id: ${c.id}`);
    defaultKeys.set(c.id, c.keys ? [...c.keys] : undefined);
    commands.set(c.id, c);
  }
}

export const getCommand = (id: string) => commands.get(id);
export const allCommands = () => [...commands.values()];
export const getDefaultKeys = (id: string) => defaultKeys.get(id);

/** Updates the live binding used by shortcuts, menu accelerators, and tooltips. */
export function setCommandKeys(id: string, keys: string[] | undefined) {
  const command = commands.get(id);
  if (!command) return;
  if (keys?.length) command.keys = keys;
  else delete command.keys;
}

export function runCommand(id: string) {
  const command = commands.get(id);
  if (!command) {
    console.warn(`Unknown command: ${id}`);
    return;
  }
  void command.run();
}

/** "Save (⌘S)" for tooltips and aria-labels; just the label when there's no shortcut. */
export function commandTitle(id: string, label?: string): string {
  const c = commands.get(id);
  const text = label ?? c?.label ?? id;
  const key = c?.keys?.[0];
  return key ? `${text} (${formatShortcut(key)})` : text;
}

/** Test helper. */
export function clearCommands() {
  commands.clear();
  defaultKeys.clear();
}
