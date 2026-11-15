import { create } from "zustand";
import { select, useSubtitles } from "@/features/subtitles/store";
import { commands, inTauri } from "@/lib/tauri";
import { refreshSpellLists, useSpell } from "./store";
import type { SpellIssue } from "./types";

export interface SpellHit {
  cueIndex: number;
  issue: SpellIssue;
}

interface Session {
  hits: SpellHit[];
  at: number;
  engine: string | null;
  suggestions: string[];
  draft: string;
  status: "idle" | "checking" | "ready";
}

export const useSpellSession = create<Session>()(() => ({
  hits: [],
  at: 0,
  engine: null,
  suggestions: [],
  draft: "",
  status: "idle",
}));

async function focusAt(hits: SpellHit[], at: number) {
  const hit = hits[at];
  if (!hit) {
    useSpellSession.setState({ suggestions: [], draft: "" });
    return;
  }
  select(useSubtitles.getState().cues[hit.cueIndex]?.id ?? null);
  useSpellSession.setState({ draft: hit.issue.word });
  if (!inTauri) {
    useSpellSession.setState({ suggestions: [] });
    return;
  }
  const language = useSpell.getState().language;
  const r = await commands.spellSuggest(hit.issue.word, language);
  useSpellSession.setState({ suggestions: r.suggestions });
}

export async function runSpellSession() {
  useSpellSession.setState({ status: "checking", hits: [], at: 0 });
  if (!inTauri) {
    useSpellSession.setState({ status: "ready", engine: null });
    return;
  }
  await refreshSpellLists();
  const language = useSpell.getState().language;
  const texts = useSubtitles.getState().cues.map((c) => c.text);
  const res = await commands.spellCheckTexts(texts, language, false);
  const hits: SpellHit[] = [];
  res.issues.forEach((list, cueIndex) => {
    for (const issue of list) hits.push({ cueIndex, issue });
  });
  useSpellSession.setState({ hits, at: 0, engine: res.engine, status: "ready" });
  await focusAt(hits, 0);
}

export function resetSpellSession() {
  useSpellSession.setState({
    hits: [],
    at: 0,
    engine: null,
    suggestions: [],
    draft: "",
    status: "idle",
  });
}

export async function spellSkip() {
  const { hits, at } = useSpellSession.getState();
  const nextAt = Math.min(at + 1, Math.max(0, hits.length - 1));
  useSpellSession.setState({ at: nextAt });
  await focusAt(hits, nextAt);
}

export async function spellDropCurrentWord() {
  const { hits, at } = useSpellSession.getState();
  const word = hits[at]?.issue.word;
  if (!word) return;
  const next = hits.filter((h) => h.issue.word.toLowerCase() !== word.toLowerCase());
  const nextAt = Math.min(at, Math.max(0, next.length - 1));
  useSpellSession.setState({ hits: next, at: nextAt });
  await focusAt(next, nextAt);
}

export async function spellAfterReplace() {
  const { hits, at } = useSpellSession.getState();
  const next = hits.filter((_, i) => i !== at);
  const nextAt = Math.min(at, Math.max(0, next.length - 1));
  useSpellSession.setState({ hits: next, at: nextAt });
  await focusAt(next, nextAt);
}
