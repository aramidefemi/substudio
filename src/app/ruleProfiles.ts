import { toast } from "sonner";
import { create } from "zustand";
import { saveRuleProfile, setLastRuleProfileId, useSettings } from "@/features/settings/store";
import { getActiveProfile } from "@/features/subtitles/activeRules";
import { findProfile, resolveSnapshot } from "@/features/subtitles/ruleProfiles";
import { setRuleProfileId, useSubtitles } from "@/features/subtitles/store";
import { useMedia } from "@/features/media/store";
import { commands, inTauri } from "@/lib/tauri";
import { buildProject } from "./project";

/** Open state of the rule profiles editor (RUL-01). */
export const useRuleProfilesDialog = create<{ open: boolean }>()(() => ({ open: false }));
export const openRuleProfiles = () => useRuleProfilesDialog.setState({ open: true });
export const closeRuleProfiles = () => useRuleProfilesDialog.setState({ open: false });

/** The sidecar for the current document, including profile snapshot + audio track + shots. */
export const currentProject = () =>
  buildProject({
    ...useSubtitles.getState(),
    ruleProfile: getActiveProfile(),
    audioTrack: useMedia.getState().audioTrack,
    shotChanges: useMedia.getState().shotChanges,
  });

/**
 * Makes `id` the project's profile and the default for documents without one.
 * A saved, unchanged document gets its sidecar updated right away so the
 * choice survives closing without another save; a dirty one is written on save.
 */
export function chooseRuleProfile(id: string) {
  const profile = findProfile(id, useSettings.getState().ruleProfiles);
  setRuleProfileId(profile.id);
  setLastRuleProfileId(profile.id);
  const { filePath, dirty } = useSubtitles.getState();
  if (inTauri && filePath && !dirty) {
    commands.writeProject(filePath, currentProject()).catch((err: unknown) => {
      console.warn("Could not write the project sidecar", err);
    });
  }
}

/**
 * Applies the profile a sidecar names (or the last chosen one when it names
 * none). A user profile from another machine is added to this one's list.
 */
export function applyProjectProfile(raw: unknown) {
  const settings = useSettings.getState();
  const resolved = resolveSnapshot(raw, settings.ruleProfiles);
  if (!resolved) {
    setRuleProfileId(findProfile(settings.lastRuleProfileId, settings.ruleProfiles).id);
    return;
  }
  if (resolved.imported) {
    saveRuleProfile(resolved.imported);
    toast(`Added rule profile “${resolved.imported.name}”`, { description: "It came with this project." });
  }
  setRuleProfileId(resolved.id);
}

/** At startup, before any document opens: use the last chosen profile. */
export function initRuleProfile() {
  applyProjectProfile(null);
}
