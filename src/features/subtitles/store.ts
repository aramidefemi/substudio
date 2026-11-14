import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from "immer";
import { create } from "zustand";
import type { TimecodeMode, TimeFormat } from "./timecode";
import {
  CUSTOM_STEP,
  MS_STEP,
  MIN_GAP,
  extendNextStartToSelected,
  extendPreviousEndToSelected,
  extendToNext,
  extendToPrevious,
  frameStep,
  nudgeEdge,
  setEndAndStartOfNext,
  setEndAt,
  setStartAndEndOfPrevious,
  setStartAt,
  shiftAll,
  shiftIndices,
  snapAllToFrames,
  type Edge,
  type NudgeMode,
  type SetStartOpts,
} from "./timing";
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
  /** Primary cue for the editor / playhead follow. */
  selectedId: string | null;
  /** Multi-select set; always includes `selectedId` when that is set. */
  selectedIds: string[];
  /** Anchor for Shift-click ranges. */
  selectionAnchor: string | null;
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

const firstId = sampleCues[0]?.id ?? null;

export const useSubtitles = create<SubtitleState>()(() => ({
  cues: sampleCues,
  selectedId: firstId,
  selectedIds: firstId ? [firstId] : [],
  selectionAnchor: firstId,
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
function clearTypingMerge(past: HistoryEntry[]): HistoryEntry[] {
  const last = past.at(-1);
  return last?.key ? [...past.slice(0, -1), { ...last, key: undefined }] : past;
}

function setSelection(ids: string[], primary: string | null, anchor: string | null = primary) {
  const s = get();
  set({
    selectedIds: ids,
    selectedId: primary,
    selectionAnchor: anchor,
    past: clearTypingMerge(s.past),
  });
}

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
  const alive = new Set(s.cues.map((c) => c.id));
  const selectedIds = s.selectedIds.filter((id) => alive.has(id));
  const selectedId =
    s.selectedId && alive.has(s.selectedId) ? s.selectedId : (selectedIds[0] ?? s.cues[0]?.id ?? null);
  if (selectedId && !selectedIds.includes(selectedId)) selectedIds.push(selectedId);
  const selectionAnchor =
    s.selectionAnchor && alive.has(s.selectionAnchor) ? s.selectionAnchor : selectedId;
  if (
    selectedId !== s.selectedId ||
    selectionAnchor !== s.selectionAnchor ||
    selectedIds.length !== s.selectedIds.length ||
    selectedIds.some((id, i) => id !== s.selectedIds[i])
  ) {
    set({ selectedId, selectedIds, selectionAnchor });
  }
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

/** Summarise an immer patch set for the undo history panel. */
export function summarizePatches(patches: readonly Patch[]): string {
  const paths = patches.map((p) => p.path.map(String).join("."));
  const joined = paths.join(" ");
  if (/\.text\b|text$/.test(joined)) return "Edit text";
  if (/\.start|\.end/.test(joined)) return "Change timing";
  if (patches.some((p) => p.op === "add" && p.path[0] === "cues")) return "Add line";
  if (patches.some((p) => p.op === "remove" && p.path[0] === "cues")) return "Delete line";
  if (patches.some((p) => p.path[0] === "cues" && p.path.length === 1)) return "Reorder / replace lines";
  return "Edit";
}

export interface HistoryStep {
  index: number;
  label: string;
}

/** Past steps newest-last. */
export function listHistorySteps(): HistoryStep[] {
  return get().past.map((entry, index) => ({
    index,
    label: summarizePatches(entry.patches),
  }));
}

/** Undo until `past.length === index` (0 = empty history). */
export function restoreHistoryTo(index: number): boolean {
  const target = Math.max(0, Math.min(index, get().past.length));
  let changed = false;
  while (get().past.length > target) {
    if (!undo()) break;
    changed = true;
  }
  return changed;
}

/* ---------- document ---------- */

export function loadDocument(cues: CueData[], filePath: string | null, keepVideo = false) {
  const withId = withIds(cues);
  const id = withId[0]?.id ?? null;
  set({
    cues: withId,
    selectedId: id,
    selectedIds: id ? [id] : [],
    selectionAnchor: id,
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
    selectedIds: [],
    selectionAnchor: null,
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

/** Replace the selection with a single cue (or clear). */
export function select(id: string | null) {
  const s = get();
  if (s.selectedId === id && s.selectedIds.length === (id ? 1 : 0)) return;
  setSelection(id ? [id] : [], id);
}

/** ⌘/Ctrl-click: toggle membership; primary becomes `id`. */
export function toggleSelect(id: string) {
  const s = get();
  const has = s.selectedIds.includes(id);
  const selectedIds = has ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id];
  const primary = has ? (selectedIds.at(-1) ?? null) : id;
  setSelection(selectedIds, primary, id);
}

/** Shift-click: select the inclusive range from the anchor to `id`. */
export function selectRangeTo(id: string) {
  const s = get();
  const anchor = s.selectionAnchor ?? s.selectedId ?? id;
  const a = s.cues.findIndex((c) => c.id === anchor);
  const b = s.cues.findIndex((c) => c.id === id);
  if (a < 0 || b < 0) return select(id);
  const [lo, hi] = a < b ? [a, b] : [b, a];
  setSelection(
    s.cues.slice(lo, hi + 1).map((c) => c.id),
    id,
    anchor,
  );
}

export function selectAll() {
  const s = get();
  if (!s.cues.length) return;
  const ids = s.cues.map((c) => c.id);
  const primary = s.selectedId && ids.includes(s.selectedId) ? s.selectedId : ids[0]!;
  setSelection(ids, primary, s.selectionAnchor ?? primary);
}

export function invertSelection() {
  const s = get();
  if (!s.cues.length) return;
  const setIds = new Set(s.selectedIds);
  const ids = s.cues.filter((c) => !setIds.has(c.id)).map((c) => c.id);
  const primary = ids.includes(s.selectedId!) ? s.selectedId : (ids[0] ?? null);
  setSelection(ids, primary, primary);
}

export function selectRelative(delta: number) {
  const s = get();
  if (!s.cues.length) return;
  const i = Math.max(0, Math.min(s.cues.length - 1, selectSelectedIndex(s) + delta));
  select(s.cues[i]!.id);
}

export function selectedCues(): Cue[] {
  const s = get();
  const setIds = new Set(s.selectedIds);
  return s.cues.filter((c) => setIds.has(c.id));
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

/** Map text of every selected cue (document order). */
export function mapSelectedTexts(fn: (text: string) => string) {
  const ids = new Set(get().selectedIds);
  if (!ids.size) return;
  edit((doc) => {
    for (const cue of doc.cues) {
      if (ids.has(cue.id)) cue.text = fn(cue.text);
    }
  });
}

/** Inserts a cue at `t` (default 2 s, shortened to fit before the next cue) and selects it. */
export function insertCue(t: number, duration = 2): string {
  const id = newId();
  edit((doc) => {
    let i = doc.cues.findIndex((c) => c.start > t);
    if (i === -1) i = doc.cues.length;
    const prev = doc.cues[i - 1];
    const next = doc.cues[i];
    const start = prev && t < prev.end ? prev.end + MIN_GAP : t;
    let end = start + duration;
    if (next && end > next.start - MIN_GAP) end = Math.max(start + 0.3, next.start - MIN_GAP);
    doc.cues.splice(i, 0, { id, start, end, text: "" });
  });
  select(id);
  return id;
}

export type TimingStep = "frame" | "ms" | "custom";

function stepSeconds(kind: TimingStep, fps: number): number {
  if (kind === "frame") return frameStep(fps);
  if (kind === "ms") return MS_STEP;
  return CUSTOM_STEP;
}

function selectedIndices(): number[] {
  const s = get();
  const ids = new Set(s.selectedIds);
  const out: number[] = [];
  for (let i = 0; i < s.cues.length; i++) if (ids.has(s.cues[i]!.id)) out.push(i);
  return out;
}

function primaryIndex(): number {
  return selectSelectedIndex(get());
}

/** Global nudge of the primary cue's start or end. */
export function nudgeSelectedEdge(edge: Edge, delta: number, mode: NudgeMode = "plain") {
  const i = primaryIndex();
  if (i < 0) return;
  edit((doc) => nudgeEdge(doc.cues, i, edge, delta, mode));
}

export function nudgeSelectedEdgeBy(edge: Edge, kind: TimingStep, dir: 1 | -1, mode: NudgeMode = "plain") {
  nudgeSelectedEdge(edge, dir * stepSeconds(kind, get().fps), mode);
}

export function moveSelectedBy(kind: TimingStep, dir: 1 | -1, withFollowing = false) {
  const indices = selectedIndices();
  if (!indices.length) return;
  const delta = dir * stepSeconds(kind, get().fps);
  edit((doc) => shiftIndices(doc.cues, indices, delta, withFollowing));
}

export function moveAllBy(kind: TimingStep, dir: 1 | -1) {
  if (!get().cues.length) return;
  const delta = dir * stepSeconds(kind, get().fps);
  edit((doc) => shiftAll(doc.cues, delta));
}

export function setSelectedStartAt(t: number, opts?: SetStartOpts) {
  const i = primaryIndex();
  if (i < 0) return;
  edit((doc) => setStartAt(doc.cues, i, t, opts));
}

export function setSelectedEndAt(t: number) {
  const i = primaryIndex();
  if (i < 0) return;
  edit((doc) => setEndAt(doc.cues, i, t));
}

/** Set end at `t`, select next (if any). */
export function setEndAndGoToNext(t: number) {
  const i = primaryIndex();
  if (i < 0) return;
  edit((doc) => setEndAt(doc.cues, i, t));
  selectRelative(1);
}

/** Set start at `t`, select next (if any). */
export function setStartAndGoToNext(t: number, opts?: SetStartOpts) {
  const i = primaryIndex();
  if (i < 0) return;
  edit((doc) => setStartAt(doc.cues, i, t, opts));
  selectRelative(1);
}

/**
 * Set end at `t`, insert a new cue after the minimum gap, select it.
 * Returns the new cue id, or null if nothing was selected.
 */
export function setEndAddNewAndGoToNew(t: number): string | null {
  const i = primaryIndex();
  if (i < 0) return null;
  let newIdOut: string | null = null;
  edit((doc) => {
    setEndAt(doc.cues, i, t);
    const cur = doc.cues[i]!;
    const start = cur.end + MIN_GAP;
    const next = doc.cues[i + 1];
    let end = start + 2;
    if (next && end > next.start - MIN_GAP) end = Math.max(start + 0.3, next.start - MIN_GAP);
    const id = newId();
    newIdOut = id;
    doc.cues.splice(i + 1, 0, { id, start, end, text: "" });
  });
  if (newIdOut) select(newIdOut);
  return newIdOut;
}

export function setEndAndStartOfNextAfterGap(t: number) {
  const i = primaryIndex();
  if (i < 0) return;
  edit((doc) => setEndAndStartOfNext(doc.cues, i, t));
}

export function setStartAndEndOfPreviousMinusGap(t: number) {
  const i = primaryIndex();
  if (i < 0) return;
  edit((doc) => setStartAndEndOfPrevious(doc.cues, i, t));
}

export function extendSelectedToPrevious() {
  const i = primaryIndex();
  if (i < 0) return;
  edit((doc) => extendToPrevious(doc.cues, i));
}

export function extendSelectedToNext() {
  const i = primaryIndex();
  if (i < 0) return;
  edit((doc) => extendToNext(doc.cues, i));
}

export function extendPreviousEndToCurrent() {
  const i = primaryIndex();
  if (i < 0) return;
  edit((doc) => extendPreviousEndToSelected(doc.cues, i));
}

export function extendNextStartToCurrent() {
  const i = primaryIndex();
  if (i < 0) return;
  edit((doc) => extendNextStartToSelected(doc.cues, i));
}

export function snapAllTimesToFrames() {
  const { cues, fps } = get();
  if (!cues.length) return;
  edit((doc) => snapAllToFrames(doc.cues, fps));
}

export function removeCue(id: string) {
  removeCues([id]);
}

/** Deletes cues by id (document order) and selects a neighbour of the first removed. */
export function removeCues(ids: readonly string[]) {
  if (!ids.length) return;
  const s = get();
  const remove = new Set(ids);
  const firstIdx = s.cues.findIndex((c) => remove.has(c.id));
  if (firstIdx === -1) return;
  let neighbour: string | null = null;
  for (let i = firstIdx + 1; i < s.cues.length; i++) {
    if (!remove.has(s.cues[i]!.id)) {
      neighbour = s.cues[i]!.id;
      break;
    }
  }
  if (!neighbour) {
    for (let i = firstIdx - 1; i >= 0; i--) {
      if (!remove.has(s.cues[i]!.id)) {
        neighbour = s.cues[i]!.id;
        break;
      }
    }
  }
  edit((doc) => {
    doc.cues = doc.cues.filter((c) => !remove.has(c.id));
  });
  select(neighbour);
}

/** Inserts cues (new ids), sorted into the document; selects the pasted set. */
export function pasteCues(incoming: readonly CueData[]) {
  if (!incoming.length) return;
  const ids = incoming.map(() => newId());
  edit((doc) => {
    for (let i = 0; i < incoming.length; i++) {
      const c = incoming[i]!;
      doc.cues.push({ id: ids[i]!, start: c.start, end: c.end, text: c.text });
    }
    doc.cues.sort(byStart);
  });
  setSelection(ids, ids[0]!, ids[0]!);
}
