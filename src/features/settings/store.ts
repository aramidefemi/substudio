import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import { inTauri } from "@/lib/tauri";
import type { ThemePreference } from "./themes";

export type Density = "compact" | "comfortable";

/** App-wide preferences (not per project). Saved to `settings.json` by the Rust store plugin. */
export interface Settings {
  theme: ThemePreference;
  density: Density;
}

const DEFAULTS: Settings = { theme: "system", density: "compact" };

export const useSettings = create<Settings>()(() => DEFAULTS);

export const setTheme = (theme: ThemePreference) => useSettings.setState({ theme });
export const setDensity = (density: Density) => useSettings.setState({ density });

export const ROW_HEIGHT: Record<Density, number> = { compact: 28, comfortable: 36 };

/** Loads saved settings before first paint, then saves every change. */
export async function loadSettings() {
  if (!inTauri) return;
  try {
    const store = await load("settings.json", { defaults: {}, autoSave: 200 });
    const saved = await store.get<Partial<Settings>>("settings");
    if (saved) useSettings.setState({ ...DEFAULTS, ...saved });
    useSettings.subscribe((s) => void store.set("settings", s));
  } catch (err) {
    console.error("Could not load settings", err);
  }
}
