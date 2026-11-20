import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import { normalizeOverrides, type ShortcutOverrides } from "@/app/commands/bindings";
import { inTauri } from "@/lib/tauri";
import {
  DEFAULT_PREVIEW,
  normalizePreview,
  PREVIEW_POSITIONS,
  PREVIEW_SIZES,
  stepOption,
  type PreviewStyle,
} from "./preview";
import type { ReplaceSet } from "@/features/subtitles/multipleReplace";
import { normalizePresets, type CustomTextPreset } from "@/features/export/customText";
import type { ThemePreference } from "./themes";
import { isKnownLanguage, type TranslateEngine } from "@/features/translate/languages";
import { DEFAULT_PROFILE_ID, normalizeProfiles, type RuleProfile } from "@/features/subtitles/ruleProfiles";

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
  /** Original/script column beside translation text (FIL-07). */
  showOriginalColumn: boolean;
  /** When true, render italic/bold in the grid; when false, strip tags. */
  showFormattingInGrid: boolean;
  privacy: PrivacyMode;
  /** Subtitle drawn over the video: size, box or outline, vertical position. */
  preview: PreviewStyle;
  /** Saved multiple-replace rule sets (QLT-04). */
  multipleReplaceSets: ReplaceSet[];
  /** User-created rule profiles (RUL-01); built-ins come from code. */
  ruleProfiles: RuleProfile[];
  /** Profile last chosen; used for documents whose sidecar names none. */
  lastRuleProfileId: string;
  /** User custom-text export presets (FMT-03); starters live in code. */
  customTextPresets: CustomTextPreset[];
  /**
   * Per-command shortcut overrides (EDT-08). Absent → Substudio default;
   * `[]` → unbound. Applied onto the command registry via `applyKeyBindings`.
   */
  shortcutOverrides: ShortcutOverrides;
  /** Auto-translate (TRN-01): last engine, language pair and API key. */
  translate: TranslatePrefs;
}

export interface TranslatePrefs {
  engine: TranslateEngine;
  /** Google code, or "auto" to detect. */
  source: string;
  target: string;
  /** Google Cloud Translation API key; stays in the local settings file. */
  apiKey: string;
  skipTranslated: boolean;
  /** Set after the first run, so "translate selected (no prompt)" may skip the dialog. */
  used: boolean;
}

export const DEFAULT_TRANSLATE: TranslatePrefs = {
  engine: "google-free",
  source: "yo",
  target: "en",
  apiKey: "",
  skipTranslated: true,
  used: false,
};

function normalizeTranslate(v: unknown): TranslatePrefs {
  const t = (v && typeof v === "object" ? v : {}) as Partial<TranslatePrefs>;
  return {
    engine: t.engine === "google-cloud" ? "google-cloud" : "google-free",
    source: typeof t.source === "string" && isKnownLanguage(t.source) ? t.source : DEFAULT_TRANSLATE.source,
    target:
      typeof t.target === "string" && t.target !== "auto" && isKnownLanguage(t.target) ? t.target : DEFAULT_TRANSLATE.target,
    apiKey: typeof t.apiKey === "string" ? t.apiKey : "",
    skipTranslated: typeof t.skipTranslated === "boolean" ? t.skipTranslated : true,
    used: t.used === true,
  };
}

export const setTranslatePrefs = (patch: Partial<TranslatePrefs>) =>
  useSettings.setState((s) => ({ translate: { ...s.translate, ...patch } }));

const DEFAULTS: Settings = {
  theme: "system",
  density: "compact",
  recentSubtitles: [],
  recentVideos: [],
  autoBackupIntervalSec: 60,
  autoBackupKeep: 30,
  showCpsColumn: true,
  showGapColumn: true,
  showOriginalColumn: false,
  showFormattingInGrid: true,
  privacy: "off",
  preview: DEFAULT_PREVIEW,
  multipleReplaceSets: [],
  ruleProfiles: [],
  lastRuleProfileId: DEFAULT_PROFILE_ID,
  customTextPresets: [],
  shortcutOverrides: {},
  translate: DEFAULT_TRANSLATE,
};

const RECENT_LIMIT = 12;

export const useSettings = create<Settings>()(() => DEFAULTS);

export const setTheme = (theme: ThemePreference) => useSettings.setState({ theme });
export const setDensity = (density: Density) => useSettings.setState({ density });
export const setShowCpsColumn = (showCpsColumn: boolean) => useSettings.setState({ showCpsColumn });
export const setShowGapColumn = (showGapColumn: boolean) => useSettings.setState({ showGapColumn });
export const setShowOriginalColumn = (showOriginalColumn: boolean) =>
  useSettings.setState({ showOriginalColumn });
export const setShowFormattingInGrid = (showFormattingInGrid: boolean) =>
  useSettings.setState({ showFormattingInGrid });
export const setPrivacy = (privacy: PrivacyMode) => useSettings.setState({ privacy });

export const setPreview = (patch: Partial<PreviewStyle>) =>
  useSettings.setState((s) => ({ preview: { ...s.preview, ...patch } }));

/** One size step bigger (+1) or smaller (−1). */
export const stepPreviewSize = (delta: number) =>
  setPreview({ size: stepOption(PREVIEW_SIZES, useSettings.getState().preview.size, delta) });

/** One position step higher (+1) or lower (−1); the list runs low → top. */
export const stepPreviewPosition = (delta: number) =>
  setPreview({ position: stepOption(PREVIEW_POSITIONS, useSettings.getState().preview.position, delta) });

/** Adds or replaces a user rule profile by id. */
export function saveRuleProfile(profile: RuleProfile) {
  useSettings.setState((s) => {
    const exists = s.ruleProfiles.some((p) => p.id === profile.id);
    return {
      ruleProfiles: exists ? s.ruleProfiles.map((p) => (p.id === profile.id ? profile : p)) : [...s.ruleProfiles, profile],
    };
  });
}

export function deleteRuleProfile(id: string) {
  useSettings.setState((s) => ({
    ruleProfiles: s.ruleProfiles.filter((p) => p.id !== id),
    lastRuleProfileId: s.lastRuleProfileId === id ? DEFAULT_PROFILE_ID : s.lastRuleProfileId,
  }));
}

export const setLastRuleProfileId = (lastRuleProfileId: string) => useSettings.setState({ lastRuleProfileId });

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


export function saveCustomTextPreset(preset: CustomTextPreset) {
  useSettings.setState((s) => {
    const exists = s.customTextPresets.some((p) => p.id === preset.id);
    return {
      customTextPresets: exists
        ? s.customTextPresets.map((p) => (p.id === preset.id ? preset : p))
        : [...s.customTextPresets, preset],
    };
  });
}

export function deleteCustomTextPreset(id: string) {
  useSettings.setState((s) => ({
    customTextPresets: s.customTextPresets.filter((p) => p.id !== id),
  }));
}

export const setShortcutOverrides = (shortcutOverrides: ShortcutOverrides) =>
  useSettings.setState({ shortcutOverrides });

/** Clear all overrides → Substudio defaults. */
export const resetShortcuts = () => setShortcutOverrides({});

export const ROW_HEIGHT: Record<Density, number> = { compact: 28, comfortable: 36 };

/** Loads saved settings before first paint, then saves every change. */
export async function loadSettings() {
  if (!inTauri) return;
  try {
    const store = await load("settings.json", { defaults: {}, autoSave: 200 });
    const saved = await store.get<Partial<Settings>>("settings");
    if (saved) {
      useSettings.setState({
        ...DEFAULTS,
        ...saved,
        preview: normalizePreview(saved.preview),
        multipleReplaceSets: saved.multipleReplaceSets ?? [],
        ruleProfiles: normalizeProfiles(saved.ruleProfiles),
        lastRuleProfileId: typeof saved.lastRuleProfileId === "string" ? saved.lastRuleProfileId : DEFAULT_PROFILE_ID,
        customTextPresets: normalizePresets(saved.customTextPresets),
        shortcutOverrides: normalizeOverrides(saved.shortcutOverrides),
        translate: normalizeTranslate(saved.translate),
      });
    }
    useSettings.subscribe((s) => void store.set("settings", s));
  } catch (err) {
    console.error("Could not load settings", err);
  }
}
