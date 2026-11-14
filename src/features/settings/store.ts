import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import { inTauri } from "@/lib/tauri";
import type { ThemePreference } from "./themes";

export type Density = "compact" | "comfortable";
/** Screen privacy: hide names first, then cue text (for screen sharing). */
export type PrivacyMode = "off" | "names" | "text";

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
  showCpsColumn: boolean;
  showGapColumn: boolean;
  /** When true, render italic/bold in the grid; when false, strip tags. */
  showFormattingInGrid: boolean;
  privacy: PrivacyMode;
}

const DEFAULTS: Settings = {
  theme: "system",
  density: "compact",
  recentSubtitles: [],
  recentVideos: [],
  autoBackupIntervalSec: 60,
  autoBackupKeep: 30,
  showCpsColumn: true,
  showGapColumn: true,
  showFormattingInGrid: true,
  privacy: "off",
};

const RECENT_LIMIT = 12;

export const useSettings = create<Settings>()(() => DEFAULTS);

export const setTheme = (theme: ThemePreference) => useSettings.setState({ theme });
export const setDensity = (density: Density) => useSettings.setState({ density });
export const setShowCpsColumn = (showCpsColumn: boolean) => useSettings.setState({ showCpsColumn });
export const setShowGapColumn = (showGapColumn: boolean) => useSettings.setState({ showGapColumn });
export const setShowFormattingInGrid = (showFormattingInGrid: boolean) =>
  useSettings.setState({ showFormattingInGrid });
export const setPrivacy = (privacy: PrivacyMode) => useSettings.setState({ privacy });

/** Cycles off → names → text → off. */
export function cyclePrivacy(): PrivacyMode {
  const next: Record<PrivacyMode, PrivacyMode> = { off: "names", names: "text", text: "off" };
  const privacy = next[useSettings.getState().privacy];
  useSettings.setState({ privacy });
  return privacy;
}

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
