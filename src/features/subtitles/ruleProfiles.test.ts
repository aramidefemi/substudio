import { describe, expect, it } from "vitest";
import {
  BUILT_IN_PROFILES,
  DEFAULT_PROFILE,
  findProfile,
  minGapSeconds,
  normalizeProfiles,
  resolveSnapshot,
  toRules,
  uniqueName,
  validateLimits,
  type RuleProfile,
} from "./ruleProfiles";
import { checkCue, DEFAULT_RULES } from "./rules";

const netflix = BUILT_IN_PROFILES.find((p) => p.id === "netflix-en")!;
const client: RuleProfile = {
  id: "user-a",
  name: "Client A",
  limits: { minDuration: 1.2, maxDuration: 6, maxCps: 15, maxLineLength: 37, maxLines: 2, minGap: 80, minGapUnit: "ms" },
};

describe("built-in profiles", () => {
  it("Default matches the fixed M1 limits", () => {
    expect(toRules(DEFAULT_PROFILE.limits, 25)).toEqual(DEFAULT_RULES);
  });

  it("Netflix (English): 42 chars, 2 lines, 20 cps, 5/6 s to 7 s, 2 frames apart", () => {
    expect(toRules(netflix.limits, 24)).toEqual({
      minDuration: 5 / 6,
      maxDuration: 7,
      maxCps: 20,
      maxLineLength: 42,
      maxLines: 2,
      minGap: 2 / 24,
    });
  });

  it("are all valid", () => {
    for (const p of BUILT_IN_PROFILES) expect(validateLimits(p.limits)).toBeNull();
  });
});

describe("minGapSeconds", () => {
  it("converts frames at the project fps and ms directly", () => {
    expect(minGapSeconds({ minGap: 2, minGapUnit: "frames" }, 25)).toBeCloseTo(0.08);
    expect(minGapSeconds({ minGap: 120, minGapUnit: "ms" }, 25)).toBeCloseTo(0.12);
    expect(minGapSeconds({ minGap: 0, minGapUnit: "frames" }, 25)).toBe(0);
  });
});

describe("findProfile", () => {
  it("falls back to Default for unknown ids", () => {
    expect(findProfile("user-a", [client])).toBe(client);
    expect(findProfile("gone", [client])).toBe(DEFAULT_PROFILE);
    expect(findProfile(null, [])).toBe(DEFAULT_PROFILE);
  });
});

describe("validateLimits", () => {
  it("explains bad values", () => {
    expect(validateLimits({ ...client.limits, minDuration: 8 })).toMatch(/longer than the maximum/);
    expect(validateLimits({ ...client.limits, maxLines: 0 })).toMatch(/Max lines/);
    expect(validateLimits({ ...client.limits, maxCps: NaN })).toMatch(/number/);
    expect(validateLimits({ ...client.limits, minGap: 1.5, minGapUnit: "frames" })).toMatch(/whole number/);
  });
});

describe("normalizeProfiles", () => {
  it("keeps good user profiles and drops junk, duplicates and built-in ids", () => {
    const raw = [client, { ...client }, { id: "default", name: "Fake", limits: client.limits }, { id: "x" }, 3];
    expect(normalizeProfiles(raw)).toEqual([client]);
    expect(normalizeProfiles("nope")).toEqual([]);
  });
});

describe("uniqueName", () => {
  it("adds a number when the name is taken", () => {
    expect(uniqueName("Client A", [client])).toBe("Client A 2");
    expect(uniqueName("Client B", [client])).toBe("Client B");
  });
});

describe("resolveSnapshot", () => {
  it("prefers the profile this machine has by id", () => {
    expect(resolveSnapshot({ id: "netflix-en" }, [])).toEqual({ id: "netflix-en", imported: null });
    expect(resolveSnapshot({ ...client, limits: { ...client.limits, maxCps: 99 } }, [client])).toEqual({
      id: "user-a",
      imported: null,
    });
  });

  it("imports an unknown user profile from the snapshot", () => {
    expect(resolveSnapshot(client, [])).toEqual({ id: "user-a", imported: client });
  });

  it("ignores missing or broken snapshots", () => {
    expect(resolveSnapshot(null, [])).toBeNull();
    expect(resolveSnapshot({ id: "user-z", name: "Z", limits: { maxCps: "fast" } }, [])).toBeNull();
  });
});

describe("checkCue with a profile", () => {
  it("flags short gaps only when the profile sets a minimum", () => {
    const prev = { start: 0, end: 2, text: "Ẹ ṣé." };
    const cue = { start: 2.04, end: 4, text: "Ó dàbọ̀." };
    expect(checkCue(cue, prev, DEFAULT_RULES).start).toBeUndefined();
    expect(checkCue(cue, prev, toRules(netflix.limits, 25)).start).toMatch(/Gap too short: 40 ms \(min 80 ms\)/);
    expect(checkCue({ ...cue, start: 2.08 }, prev, toRules(netflix.limits, 25)).start).toBeUndefined();
  });

  it("uses the profile's reading speed and line limits", () => {
    const cue = { start: 0, end: 1, text: "Eighteen chars ok." };
    expect(checkCue(cue, undefined, DEFAULT_RULES).text).toMatch(/Reads too fast/);
    expect(checkCue(cue, undefined, toRules(netflix.limits, 25)).text).toBeUndefined();
  });
});
