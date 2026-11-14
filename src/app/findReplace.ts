import { toast } from "sonner";
import { create } from "zustand";
import { clock } from "@/features/playback/clock";
import {
  buildMatcher,
  countMatches,
  findFrom,
  findMatches,
  replaceAll,
  replaceAt,
  type Position,
  type SearchOptions,
} from "@/features/subtitles/search";
import { select, setCueTexts, updateCue, useSubtitles } from "@/features/subtitles/store";
import { cueTextArea, cueTextSelection, setCueTextSelection } from "@/lib/dom";

/** The current hit, so find next continues after it and replace knows what to swap. */
interface CurrentMatch {
  cueId: string;
  start: number;
  end: number;
}

interface FindReplaceState extends SearchOptions {
  open: boolean;
  replacement: string;
  current: CurrentMatch | null;
  /** One-line result shown in the dialog ("Match 2 of 7", "No matches", regex errors). */
  status: string;
}

export const useFindReplace = create<FindReplaceState>()(() => ({
  open: false,
  query: "",
  replacement: "",
  matchCase: false,
  wholeWord: false,
  regex: false,
  current: null,
  status: "",
}));

const set = useFindReplace.setState;
const get = useFindReplace.getState;

export const openReplace = () => set({ open: true });

/** Changing what we search for forgets the current hit. */
export function setSearch(patch: Partial<SearchOptions & { replacement: string }>) {
  const resetsHit = Object.keys(patch).some((k) => k !== "replacement");
  set({ ...patch, ...(resetsHit ? { current: null, status: "" } : {}) });
}

function matcher() {
  const m = buildMatcher(get());
  if (!m) {
    set({ status: "Type something to find", current: null });
    return null;
  }
  if (!m.ok) {
    set({ status: `Invalid regular expression: ${m.error}`, current: null });
    return null;
  }
  return m.re;
}

/** Where to search from: after/before the current hit, else the caret, else the selected cue. */
function startPosition(dir: 1 | -1): Position {
  const { cues, selectedId } = useSubtitles.getState();
  const { current } = get();
  if (current && current.cueId === selectedId) {
    const index = cues.findIndex((c) => c.id === current.cueId);
    if (index >= 0) return { index, offset: dir > 0 ? current.end : current.start };
  }
  const index = Math.max(0, cues.findIndex((c) => c.id === selectedId));
  const caret = cueTextSelection();
  if (caret) return { index, offset: dir > 0 ? caret.end : caret.start };
  return { index, offset: dir > 0 ? 0 : Number.MAX_SAFE_INTEGER };
}

/** Selects the hit's cue and its text: focused when the dialog is closed, so typing replaces it. */
function showHit(cueId: string, start: number, end: number) {
  const cue = useSubtitles.getState().cues.find((c) => c.id === cueId);
  select(cueId);
  if (cue) clock.seek(cue.start);
  requestAnimationFrame(() => {
    if (get().open) cueTextArea()?.setSelectionRange(start, end);
    else setCueTextSelection(start, end);
  });
}

function ordinal(texts: string[], re: RegExp, index: number, start: number) {
  let n = 0;
  for (let i = 0; i < index; i++) n += findMatches(texts[i]!, re).length;
  return n + findMatches(texts[index]!, re).filter((m) => m.start < start).length + 1;
}

/** ⌘G / ⇧⌘G. Opens the dialog when there is nothing to find yet. */
export function findNext(dir: 1 | -1 = 1): boolean {
  if (!get().query) {
    openReplace();
    return false;
  }
  const re = matcher();
  if (!re) return false;
  const { cues } = useSubtitles.getState();
  const texts = cues.map((c) => c.text);
  const hit = findFrom(texts, re, startPosition(dir), dir);
  if (!hit) {
    set({ current: null, status: "No matches" });
    if (!get().open) toast("No matches", { description: get().query });
    return false;
  }
  const cue = cues[hit.index]!;
  const total = countMatches(texts, re);
  const wrapped = hit.wrapped ? (dir > 0 ? " · wrapped to the start" : " · wrapped to the end") : "";
  set({
    current: { cueId: cue.id, start: hit.start, end: hit.end },
    status: `Match ${ordinal(texts, re, hit.index, hit.start)} of ${total} (line ${hit.index + 1})${wrapped}`,
  });
  showHit(cue.id, hit.start, hit.end);
  return true;
}

/** Replace the current hit, then move to the next one. Finds first when there's no hit yet. */
export function replaceCurrent() {
  const re = matcher();
  if (!re) return;
  const { current, replacement, regex } = get();
  const cue = current && useSubtitles.getState().cues.find((c) => c.id === current.cueId);
  if (!current || !cue) {
    findNext(1);
    return;
  }
  const next = replaceAt(cue.text, re, current, replacement, regex);
  if (next === null) {
    // The text changed under us; look again from here.
    set({ current: null });
    findNext(1);
    return;
  }
  updateCue(cue.id, { text: next });
  // Continue after the inserted text, not inside it.
  const end = current.start + (next.length - (cue.text.length - (current.end - current.start)));
  set({ current: { cueId: cue.id, start: current.start, end } });
  findNext(1);
}

/** Replace every match in the document as one undo step. */
export function replaceEverywhere() {
  const re = matcher();
  if (!re) return;
  const { replacement, regex } = get();
  const { cues } = useSubtitles.getState();
  const { changes, count } = replaceAll(
    cues.map((c) => c.text),
    re,
    replacement,
    regex,
  );
  if (!count) {
    set({ status: "No matches", current: null });
    return;
  }
  const byId = new Map<string, string>();
  for (const [i, text] of changes) byId.set(cues[i]!.id, text);
  setCueTexts(byId);
  const lines = changes.size;
  const status = `Replaced ${count} match${count === 1 ? "" : "es"} in ${lines} line${lines === 1 ? "" : "s"}`;
  set({ current: null, status });
  toast.success(status, { description: "One undo step reverts them all." });
}
