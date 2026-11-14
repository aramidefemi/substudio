import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSyncExternalStore } from "react";
import { inTauri } from "@/lib/tauri";
import { useSettings } from "./store";
import { resolveTheme, type Theme } from "./themes";

const THEME_EVENT = "substudio:theme";
let current: Theme = resolveTheme("system");

/** Writes theme and density to <html> data attributes; CSS does the rest. */
function apply() {
  const { theme, density } = useSettings.getState();
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.dataset.theme = resolved.id;
  root.dataset.scheme = resolved.scheme;
  root.dataset.density = density;
  root.style.colorScheme = resolved.scheme;
  if (resolved.id !== current.id) {
    current = resolved;
    if (inTauri) void getCurrentWindow().setTheme(resolved.scheme).catch(() => {});
    window.dispatchEvent(new Event(THEME_EVENT));
  }
}

/** Call once at startup. Re-applies on settings and OS appearance changes. */
export function startAppearanceSync() {
  apply();
  if (inTauri) void getCurrentWindow().setTheme(current.scheme).catch(() => {});
  useSettings.subscribe(apply);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", apply);
}

/** For canvas drawing code that must re-read colour tokens. */
export function onThemeChange(fn: () => void) {
  window.addEventListener(THEME_EVENT, fn);
  return () => window.removeEventListener(THEME_EVENT, fn);
}

export function useResolvedTheme(): Theme {
  return useSyncExternalStore(onThemeChange, () => current);
}
