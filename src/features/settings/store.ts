import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import { inTauri } from "@/lib/tauri";
import type { ThemePreference } from "./themes";

export type Density = "compact" | "comfortable";

export interface RecentEntry {
  path: string;
  /** Video that was open with this subtitle, if any. */
  videoPath?: string | null;
}

/** App-wide preferences (not per project). Saved to `settings.json` by the Rust store plugin. */
export interface Settings {
  theme: ThemePreference;
  density: Density;
  recentSubtitles: RecentEntry[];
  recentVideos: string[];
  /** Seconds between dirty-document auto-backups. */
  autoBackupIntervalSec: number;
  /** Max auto-backup files to keep. */
  autoBackupKeep: number;
}

const DEFAULTS: Settings = {
  theme: "system",
  density: "compact",
  recentSubtitles: [],
  recentVideos: [],
  autoBackupIntervalSec: 60,
  autoBackupKeep: 30,
};

const RECENT_LIMIT = 12;

export const useSettings = create<Settings>()(() => DEFAULTS);

export const setTheme = (theme: ThemePreference) => useSettings.setState({ theme });
export const setDensity = (density: Density) => useSettings.setState({ density });

const pushUnique = <T>(list: T[], item: T, eq: (a: T, b: T) => boolean, limit: number): T[] => [
  item,
  ...list.filter((x) => !eq(x, item)),
].slice(0, limit);

export function pushRecentSubtitle(path: string, videoPath: string | null) {
  useSettings.setState((s) => ({
    recentSubtitles: pushUnique(
      s.recentSubtitles,
      { path, videoPath },
      (a, b) => a.path === b.path,
      RECENT_LIMIT,
    ),
  }));
}

export function pushRecentVideo(path: string) {
  useSettings.setState((s) => ({
    recentVideos: pushUnique(s.recentVideos, path, (a, b) => a === b, RECENT_LIMIT),
  }));
}

export function clearRecent() {
  useSettings.setState({ recentSubtitles: [], recentVideos: [] });
}

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
