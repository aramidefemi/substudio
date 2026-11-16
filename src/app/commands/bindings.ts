import { allCommands, getDefaultKeys, setCommandKeys } from "./registry";
import { SE_PRESET, sePresetKeySet } from "./sePreset";

/** Absent id → Substudio default. Present `[]` → unbound. */
export type ShortcutOverrides = Record<string, string[]>;

/** Apply persisted overrides onto the live command registry. */
export function applyKeyBindings(overrides: ShortcutOverrides) {
  for (const c of allCommands()) {
    if (Object.hasOwn(overrides, c.id)) {
      const keys = overrides[c.id]!;
      setCommandKeys(c.id, keys.length ? keys : undefined);
    } else {
      setCommandKeys(c.id, getDefaultKeys(c.id));
    }
  }
}

/** Absolute overrides for the Subtitle Edit preset (strips conflicting defaults). */
export function sePresetOverrides(): ShortcutOverrides {
  const used = sePresetKeySet();
  const out: ShortcutOverrides = {};
  for (const [id, keys] of Object.entries(SE_PRESET)) {
    out[id] = [...keys];
  }
  for (const c of allCommands()) {
    if (Object.hasOwn(out, c.id)) continue;
    const defaults = getDefaultKeys(c.id) ?? [];
    if (!defaults.some((k) => used.has(k))) continue;
    out[c.id] = defaults.filter((k) => !used.has(k));
  }
  return out;
}

/** Drop empty overrides that match the Substudio default (keeps the store small). */
export function compactOverrides(overrides: ShortcutOverrides): ShortcutOverrides {
  const out: ShortcutOverrides = {};
  for (const [id, keys] of Object.entries(overrides)) {
    const defaults = getDefaultKeys(id) ?? [];
    if (sameKeys(keys, defaults)) continue;
    out[id] = keys;
  }
  return out;
}

export function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

/** Set one command’s keys; clears the same binding from other commands. */
export function overrideCommandKeys(
  overrides: ShortcutOverrides,
  id: string,
  keys: string[] | undefined,
): ShortcutOverrides {
  const next: ShortcutOverrides = { ...overrides };
  const claimed = new Set(keys ?? []);
  if (claimed.size) {
    for (const c of allCommands()) {
      if (c.id === id) continue;
      const current = Object.hasOwn(next, c.id) ? next[c.id]! : (getDefaultKeys(c.id) ?? []);
      if (!current.some((k) => claimed.has(k))) continue;
      next[c.id] = current.filter((k) => !claimed.has(k));
    }
  }
  next[id] = keys ?? [];
  return compactOverrides(next);
}

export function normalizeOverrides(raw: unknown): ShortcutOverrides {
  if (!raw || typeof raw !== "object") return {};
  const out: ShortcutOverrides = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value) || !value.every((k) => typeof k === "string")) continue;
    out[id] = value as string[];
  }
  return out;
}
