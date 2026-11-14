import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from "immer";
import { create } from "zustand";
import type { TimecodeMode, TimeFormat } from "./timecode";
import type { Cue, CueData } from "./types";

enablePatches();

interface Doc {
  cues: Cue[];
}

/** One undo step. `key` lets consecutive edits of the same kind (typing in one cue) merge. */
interface HistoryEntry {
  patches: Patch[];
  inverse: Patch[];
  key?: string;
}

export interface SubtitleState extends Doc {
  selectedId: string | null;
  filePath: string | null;
  videoPath: string | null;
  dirty: boolean;
  timecode: TimecodeMode;
  fps: number;
  past: HistoryEntry[];
  future: HistoryEntry[];
}

const HISTORY_LIMIT = 500;

let seq = 0;
const newId = () => `c${++seq}`;
const withIds = (cues: CueData[]): Cue[] => cues.map((c) => ({ ...c, id: newId() }));

const SAMPLE: CueData[] = [
  { start: 0.32, end: 1.76, text: "My child, why are you crying?" },
  { start: 2.28, end: 3.1, text: "I'm sorry, Mama." },
  { start: 3.6, end: 4.88, text: "In Jesus' name." },
  { start: 6.4, end: 8.4, text: "God will make a way." },
  { start: 8.72, end: 10.64, text: "Have you eaten?" },
  { start: 11.04, end: 12.08, text: "Not yet." },
  { start: 13.0, end: 15.2, text: "I don't know what to do anymore." },
  { start: 15.8, end: 17.4, text: "Amen." },
];

const sampleCues = withIds(SAMPLE);

export const useSubtitles = create<SubtitleState>()(() => ({
  cues: sampleCues,
  selectedId: sampleCues[0]?.id ?? null,
  filePath: null,
  videoPath: null,
  dirty: false,
  timecode: "frames",
  fps: 25,
  past: [],
  future: [],
}));

const set = useSubtitles.setState;
const get = useSubtitles.getState;

/* ---------- selectors ---------- */

export const selectTimeFormat = (s: SubtitleState): TimeFormat => ({ mode: s.timecode, fps: s.fps });
export const selectSelectedIndex = (s: SubtitleState) => s.cues.findIndex((c) => c.id === s.selectedId);
export const selectSelectedCue = (s: SubtitleState) => s.cues.find((c) => c.id === s.selectedId);

/** Index of the cue under `t`, or -1. Cues are kept sorted by start. */
export function cueIndexAt(cues: readonly CueData[], t: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = cues[mid]!;
    if (t < c.start) hi = mid - 1;
    else if (t > c.end) lo = mid + 1;
    else return mid;
  }
  return -1;
}

/* ---------- history ---------- */

/** Every document change goes through here so it can be undone. */
export function edit(recipe: (doc: Draft<Doc>) => void, key?: string) {
  const s = get();
  const [next, patches, inverse] = produceWithPatches({ cues: s.cues } as Doc, recipe);
  if (!patches.length) return;
  const last = s.past.at(-1);
  const past =
    key && last?.key === key
      ? [...s.past.slice(0, -1), { patches: [...last.patches, ...patches], inverse: [...inverse, ...last.inverse], key }]
      : [...s.past, { patches, inverse, key }].slice(-HISTORY_LIMIT);
  set({ cues: next.cues, past, future: [], dirty: true });
}

function keepSelectionValid() {
  const s = get();
  if (!s.cues.some((c) => c.id === s.selectedId)) set({ selectedId: s.cues[0]?.id ?? null });
}

export function undo(): boolean {
  const s = get();
  const entry = s.past.at(-1);
  if (!entry) return false;
  const doc = applyPatches({ cues: s.cues } as Doc, entry.inverse);
  set({ cues: doc.cues, past: s.past.slice(0, -1), future: [...s.future, entry], dirty: true });
  keepSelectionValid();
  return true;
}

export function redo(): boolean {
  const s = get();
  const entry = s.future.at(-1);
  if (!entry) return false;
  const doc = applyPatches({ cues: s.cues } as Doc, entry.patches);
  set({ cues: doc.cues, future: s.future.slice(0, -1), past: [...s.past, entry], dirty: true });
  keepSelectionValid();
  return true;
}

/* ---------- document ---------- */

export function loadDocument(cues: CueData[], filePath: string | null, keepVideo = false) {
  const withId = withIds(cues);
  set({
    cues: withId,
    selectedId: withId[0]?.id ?? null,
    filePath,
    dirty: false,
    past: [],
    future: [],
    ...(keepVideo ? {} : { videoPath: null }),
  });
}

/** Clears the subtitle document. Pass `keepVideo` to leave the open video alone. */
export function newDocument(keepVideo = false) {
  set({
    cues: [],
    selectedId: null,
    filePath: null,
    dirty: false,
    past: [],
    future: [],
    ...(keepVideo ? {} : { videoPath: null }),
  });
}

export function markSaved(filePath: string) {
  set({ filePath, dirty: false });
}

export function setVideo(videoPath: string | null) {
  set({ videoPath });
}

/** Known on-disk mtime (ms) for the open subtitle; used to detect external edits. */
let knownMtimeMs: number | null = null;

export function getKnownMtime() {
  return knownMtimeMs;
}

export function setKnownMtime(ms: number | null) {
  knownMtimeMs = ms;
}

export function toggleTimecode() {
  set((s) => ({ timecode: s.timecode === "frames" ? "ms" : "frames" }));
}

/* ---------- selection ---------- */

export function select(id: string | null) {
  const s = get();
  if (s.selectedId === id) return;
  // A new selection starts a new undo step for typing.
  const last = s.past.at(-1);
  const past = last?.key ? [...s.past.slice(0, -1), { ...last, key: undefined }] : s.past;
  set({ selectedId: id, past });
}

export function selectRelative(delta: number) {
  const s = get();
  if (!s.cues.length) return;
  const i = Math.max(0, Math.min(s.cues.length - 1, selectSelectedIndex(s) + delta));
  select(s.cues[i]!.id);
}

/* ---------- cue edits ---------- */

const byStart = (a: CueData, b: CueData) => a.start - b.start;

export function updateCue(id: string, patch: Partial<CueData>, key?: string) {
  edit((doc) => {
    const cue = doc.cues.find((c) => c.id === id);
    if (!cue) return;
    Object.assign(cue, patch);
    if (patch.start !== undefined) doc.cues.sort(byStart);
  }, key);
}

/** Inserts a cue at `t` (default 2 s, shortened to fit before the next cue) and selects it. */
export function insertCue(t: number, duration = 2): string {
  const id = newId();
  edit((doc) => {
    let i = doc.cues.findIndex((c) => c.start > t);
    if (i === -1) i = doc.cues.length;
    const prev = doc.cues[i - 1];
    const next = doc.cues[i];
    const start = prev && t < prev.end ? prev.end + 0.04 : t;
    let end = start + duration;
    if (next && end > next.start - 0.04) end = Math.max(start + 0.3, next.start - 0.04);
    doc.cues.splice(i, 0, { id, start, end, text: "" });
  });
  select(id);
  return id;
}

export function removeCue(id: string) {
  const s = get();
  const i = s.cues.findIndex((c) => c.id === id);
  if (i === -1) return;
  const neighbour = s.cues[i + 1] ?? s.cues[i - 1];
  edit((doc) => {
    doc.cues.splice(i, 1);
  });
  select(neighbour?.id ?? null);
}
