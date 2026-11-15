export type SpellListKind = "names" | "dictionary";

export interface SpellIssue {
  start: number;
  end: number;
  word: string;
}

export interface SpellCheckResult {
  engine: string | null;
  language: string;
  issues: SpellIssue[][];
}

export interface SpellSuggestResult {
  suggestions: string[];
}
