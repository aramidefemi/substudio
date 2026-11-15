import { create } from "zustand";
import { commands, inTauri } from "@/lib/tauri";
import type { SpellIssue, SpellListKind } from "./types";

interface SpellState {
  enabled: boolean;
  language: string;
  names: string[];
  dictionary: string[];
  /** Issues per cue index for live underlines. */
  liveIssues: SpellIssue[][];
  busy: boolean;
}

export const useSpell = create<SpellState>()(() => ({
  enabled: true,
  language: "en",
  names: [],
  dictionary: [],
  liveIssues: [],
  busy: false,
}));

export async function refreshSpellLists() {
  if (!inTauri) return;
  try {
    const [names, dictionary] = await Promise.all([
      commands.spellListWords("names"),
      commands.spellListWords("dictionary"),
    ]);
    useSpell.setState({ names, dictionary });
  } catch (err) {
    console.error("spell lists", err);
  }
}

export async function addSpellWord(kind: SpellListKind, word: string) {
  if (!inTauri) return;
  await commands.spellAddWord(kind, word);
  await refreshSpellLists();
}

let liveTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced batch check for live underlines. */
export function scheduleLiveSpellCheck(texts: string[]) {
  if (liveTimer) clearTimeout(liveTimer);
  liveTimer = setTimeout(() => {
    void runLiveSpellCheck(texts);
  }, 280);
}

async function runLiveSpellCheck(texts: string[]) {
  if (!inTauri || !useSpell.getState().enabled) {
    useSpell.setState({ liveIssues: [] });
    return;
  }
  useSpell.setState({ busy: true });
  try {
    const res = await commands.spellCheckTexts(texts, useSpell.getState().language, false);
    useSpell.setState({ liveIssues: res.issues, busy: false });
  } catch {
    useSpell.setState({ liveIssues: [], busy: false });
  }
}

export function issuesForCue(index: number): SpellIssue[] {
  return useSpell.getState().liveIssues[index] ?? [];
}
