import type { CueData } from "./types";

export interface ReplaceRule {
  find: string;
  replace: string;
  matchCase?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  enabled?: boolean;
}

export interface ReplaceSet {
  id: string;
  name: string;
  rules: ReplaceRule[];
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Apply one rule to a string. Returns original text if the pattern is invalid. */
export function applyReplaceRule(text: string, rule: ReplaceRule): string {
  if (rule.enabled === false || !rule.find) return text;
  try {
    let source = rule.regex ? rule.find : escapeRegExp(rule.find);
    if (rule.wholeWord && !rule.regex) source = `\\b${source}\\b`;
    const flags = rule.matchCase ? "g" : "gi";
    return text.replace(new RegExp(source, flags), rule.replace);
  } catch {
    return text;
  }
}

export function applyReplaceRules(text: string, rules: readonly ReplaceRule[]): string {
  return rules.reduce((t, r) => applyReplaceRule(t, r), text);
}

export function applyReplaceSet(cues: readonly CueData[], rules: readonly ReplaceRule[]): CueData[] {
  return cues.map((c) => ({ ...c, text: applyReplaceRules(c.text, rules) }));
}

export function countRuleHits(cues: readonly CueData[], rule: ReplaceRule): number {
  if (rule.enabled === false || !rule.find) return 0;
  try {
    let source = rule.regex ? rule.find : escapeRegExp(rule.find);
    if (rule.wholeWord && !rule.regex) source = `\\b${source}\\b`;
    const flags = rule.matchCase ? "g" : "gi";
    const re = new RegExp(source, flags);
    let n = 0;
    for (const c of cues) {
      const m = c.text.match(re);
      if (m) n += m.length;
    }
    return n;
  } catch {
    return 0;
  }
}

export function newReplaceSet(name = "Untitled"): ReplaceSet {
  return {
    id: `rs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    rules: [{ find: "", replace: "", matchCase: false, wholeWord: false, regex: false, enabled: true }],
  };
}
