/**
 * Shortcuts are written once, in tinykeys syntax (`$mod+Shift+KeyS`,
 * `Alt+ArrowLeft`, `F10`), and converted here for the native menu and for
 * display.
 */

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const NAMED_KEYS: Record<string, { accel: string; mac: string; other: string }> = {
  ArrowLeft: { accel: "Left", mac: "←", other: "Left" },
  ArrowRight: { accel: "Right", mac: "→", other: "Right" },
  ArrowUp: { accel: "Up", mac: "↑", other: "Up" },
  ArrowDown: { accel: "Down", mac: "↓", other: "Down" },
  Enter: { accel: "Return", mac: "↩", other: "Enter" },
  Backspace: { accel: "Backspace", mac: "⌫", other: "Backspace" },
  Delete: { accel: "Delete", mac: "⌦", other: "Delete" },
  Escape: { accel: "Escape", mac: "⎋", other: "Esc" },
  Space: { accel: "Space", mac: "Space", other: "Space" },
  Insert: { accel: "Insert", mac: "Ins", other: "Insert" },
  Home: { accel: "Home", mac: "↖", other: "Home" },
  End: { accel: "End", mac: "↘", other: "End" },
};

type Modifier = "Control" | "Alt" | "Shift" | "$mod" | "Meta";

function split(binding: string): { mods: Set<Modifier>; key: string } {
  const parts = binding.split("+");
  const key = parts.pop() ?? "";
  return { mods: new Set(parts as Modifier[]), key };
}

function keyName(key: string, target: "accel" | "mac" | "other"): string {
  const named = NAMED_KEYS[key];
  if (named) return named[target];
  const letter = /^Key([A-Z])$/.exec(key);
  if (letter) return letter[1]!;
  const digit = /^Digit(\d)$/.exec(key);
  if (digit) return digit[1]!;
  return key;
}

/** Tauri accelerator string, e.g. `CmdOrCtrl+Shift+S`. */
export function toAccelerator(binding: string): string {
  const { mods, key } = split(binding);
  const out: string[] = [];
  if (mods.has("$mod")) out.push("CmdOrCtrl");
  if (mods.has("Meta")) out.push("Super");
  if (mods.has("Control")) out.push("Ctrl");
  if (mods.has("Alt")) out.push("Alt");
  if (mods.has("Shift")) out.push("Shift");
  out.push(keyName(key, "accel"));
  return out.join("+");
}

/** Human label: `⇧⌘S` on macOS, `Ctrl+Shift+S` elsewhere. */
export function formatShortcut(binding: string, mac = isMac): string {
  const { mods, key } = split(binding);
  if (mac) {
    // macOS order: ⌃ ⌥ ⇧ ⌘
    const sym = [
      mods.has("Control") ? "⌃" : "",
      mods.has("Alt") ? "⌥" : "",
      mods.has("Shift") ? "⇧" : "",
      mods.has("$mod") || mods.has("Meta") ? "⌘" : "",
    ].join("");
    return sym + keyName(key, "mac");
  }
  const out: string[] = [];
  if (mods.has("$mod") || mods.has("Control")) out.push("Ctrl");
  if (mods.has("Meta")) out.push("Win");
  if (mods.has("Alt")) out.push("Alt");
  if (mods.has("Shift")) out.push("Shift");
  out.push(keyName(key, "other"));
  return out.join("+");
}
