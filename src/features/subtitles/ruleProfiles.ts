import type { Rules } from "./rules";

/**
 * Rule profiles per client (RUL-01). A profile holds the limits as the user
 * types them (gap in frames or ms); `toRules` turns them into seconds for the
 * checks. Built-ins are fixed; user profiles live in app settings and the
 * project sidecar keeps a snapshot of the one a project uses.
 */
export type GapUnit = "frames" | "ms";

export interface ProfileLimits {
  /** Seconds. */
  minDuration: number;
  /** Seconds. */
  maxDuration: number;
  maxCps: number;
  maxLineLength: number;
  maxLines: number;
  /** In `minGapUnit`; 0 turns the gap check off. */
  minGap: number;
  minGapUnit: GapUnit;
}

export interface RuleProfile {
  id: string;
  name: string;
  builtIn?: boolean;
  limits: ProfileLimits;
}

export const DEFAULT_PROFILE_ID = "default";

/**
 * Netflix values come from its English (USA) Timed Text Style Guide and the
 * general requirements: 42 chars/line, 2 lines, 20 cps adult / 17 cps
 * children, 5/6 s minimum and 7 s maximum duration, 2 frames between events.
 */
export const BUILT_IN_PROFILES: readonly RuleProfile[] = [
  {
    id: DEFAULT_PROFILE_ID,
    name: "Default",
    builtIn: true,
    limits: { minDuration: 1, maxDuration: 7, maxCps: 17, maxLineLength: 42, maxLines: 2, minGap: 0, minGapUnit: "frames" },
  },
  {
    id: "netflix-en",
    name: "Netflix (English)",
    builtIn: true,
    limits: { minDuration: 5 / 6, maxDuration: 7, maxCps: 20, maxLineLength: 42, maxLines: 2, minGap: 2, minGapUnit: "frames" },
  },
  {
    id: "netflix-en-children",
    name: "Netflix (English, children)",
    builtIn: true,
    limits: { minDuration: 5 / 6, maxDuration: 7, maxCps: 17, maxLineLength: 42, maxLines: 2, minGap: 2, minGapUnit: "frames" },
  },
];

export const DEFAULT_PROFILE = BUILT_IN_PROFILES[0]!;

export function minGapSeconds(l: Pick<ProfileLimits, "minGap" | "minGapUnit">, fps: number): number {
  if (l.minGap <= 0) return 0;
  return l.minGapUnit === "frames" ? l.minGap / (fps > 0 ? fps : 25) : l.minGap / 1000;
}

export function toRules(l: ProfileLimits, fps: number): Rules {
  return {
    minDuration: l.minDuration,
    maxDuration: l.maxDuration,
    maxCps: l.maxCps,
    maxLineLength: l.maxLineLength,
    maxLines: l.maxLines,
    minGap: minGapSeconds(l, fps),
  };
}

export const allProfiles = (custom: readonly RuleProfile[]): RuleProfile[] => [...BUILT_IN_PROFILES, ...custom];

/** The profile with `id`, or Default when it no longer exists (deleted, other machine). */
export function findProfile(id: string | null | undefined, custom: readonly RuleProfile[]): RuleProfile {
  return allProfiles(custom).find((p) => p.id === id) ?? DEFAULT_PROFILE;
}

/** Why these limits can't be saved, or null when they're fine. */
export function validateLimits(l: ProfileLimits): string | null {
  const finite = Object.values(l).every((v) => typeof v === "string" || Number.isFinite(v));
  if (!finite) return "Every limit needs a number.";
  if (l.minDuration < 0) return "Minimum duration can't be negative.";
  if (l.maxDuration <= 0) return "Maximum duration must be more than 0 s.";
  if (l.minDuration > l.maxDuration) return "Minimum duration is longer than the maximum.";
  if (l.maxCps <= 0) return "Reading speed must be more than 0.";
  if (l.maxLineLength < 1 || !Number.isInteger(l.maxLineLength)) return "Line length must be a whole number of 1 or more.";
  if (l.maxLines < 1 || !Number.isInteger(l.maxLines)) return "Max lines must be a whole number of 1 or more.";
  if (l.minGap < 0) return "Minimum gap can't be negative.";
  if (l.minGapUnit === "frames" && !Number.isInteger(l.minGap)) return "A gap in frames must be a whole number.";
  return null;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);

/** Limits from untrusted JSON (settings, sidecar); null when unusable. */
export function normalizeLimits(raw: unknown): ProfileLimits | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const limits: ProfileLimits = {
    minDuration: num(r.minDuration),
    maxDuration: num(r.maxDuration),
    maxCps: num(r.maxCps),
    maxLineLength: num(r.maxLineLength),
    maxLines: num(r.maxLines),
    minGap: num(r.minGap ?? 0),
    minGapUnit: r.minGapUnit === "ms" ? "ms" : "frames",
  };
  return validateLimits(limits) ? null : limits;
}

/** One profile from untrusted JSON; never a built-in (those always come from code). */
export function normalizeProfile(raw: unknown): RuleProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const limits = normalizeLimits(r.limits);
  if (typeof r.id !== "string" || !r.id || typeof r.name !== "string" || !limits) return null;
  if (BUILT_IN_PROFILES.some((p) => p.id === r.id)) return null;
  return { id: r.id, name: r.name.trim() || "Untitled", limits };
}

/** User profiles from saved settings: bad entries and duplicate ids are dropped. */
export function normalizeProfiles(raw: unknown): RuleProfile[] {
  if (!Array.isArray(raw)) return [];
  const out: RuleProfile[] = [];
  for (const item of raw) {
    const p = normalizeProfile(item);
    if (p && !out.some((o) => o.id === p.id)) out.push(p);
  }
  return out;
}

/** "Netflix (English) copy", then "… copy 2" if that's taken. */
export function uniqueName(base: string, profiles: readonly RuleProfile[]): string {
  const taken = new Set(profiles.map((p) => p.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
}

export function newProfileId(): string {
  return `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** The sidecar snapshot of the active profile (so a project keeps its rules on another machine). */
export type ProfileSnapshot = Pick<RuleProfile, "id" | "name" | "limits">;

export const snapshotOf = (p: RuleProfile): ProfileSnapshot => ({ id: p.id, name: p.name, limits: { ...p.limits } });

/**
 * Which profile a project's sidecar asks for. A built-in or a known user
 * profile wins by id (the user's current version); an unknown one is imported
 * from the snapshot. Null when the sidecar names no usable profile.
 */
export function resolveSnapshot(
  raw: unknown,
  custom: readonly RuleProfile[],
): { id: string; imported: RuleProfile | null } | null {
  if (!raw || typeof raw !== "object") return null;
  const id = (raw as { id?: unknown }).id;
  if (typeof id !== "string" || !id) return null;
  if (allProfiles(custom).some((p) => p.id === id)) return { id, imported: null };
  const imported = normalizeProfile(raw);
  if (!imported) return null;
  return { id, imported: { ...imported, name: uniqueName(imported.name, allProfiles(custom)) } };
}
