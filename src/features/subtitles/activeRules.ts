import { useSettings } from "@/features/settings/store";
import { findProfile, toRules, type RuleProfile } from "./ruleProfiles";
import type { Rules } from "./rules";
import { useSubtitles } from "./store";

/** The project's active rule profile (RUL-01), outside React. */
export function getActiveProfile(): RuleProfile {
  return findProfile(useSubtitles.getState().ruleProfileId, useSettings.getState().ruleProfiles);
}

/** The active limits in seconds (gap converted at the project's fps), outside React. */
export function getRules(): Rules {
  return toRules(getActiveProfile().limits, useSubtitles.getState().fps);
}

export function useActiveProfile(): RuleProfile {
  const id = useSubtitles((s) => s.ruleProfileId);
  const custom = useSettings((s) => s.ruleProfiles);
  return findProfile(id, custom);
}

/** Every consumer of the quality rules reads them through here so they follow the active profile. */
export function useRules(): Rules {
  const profile = useActiveProfile();
  const fps = useSubtitles((s) => s.fps);
  return toRules(profile.limits, fps);
}
