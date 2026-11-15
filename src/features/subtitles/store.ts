import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from "immer";
import { create } from "zustand";
import { snapAllToSourceFrames } from "@/features/media/frameTimes";
import { snapCueToShots } from "@/features/media/shotChanges";
import { useMedia } from "@/features/media/store";
import type { TimecodeMode, TimeFormat } from "./timecode";
import {
  fitCueInGap,
  mergeMany,
  mergeTexts,
  rippleSpan,
  splitCueAtCursor,
  splitCueAtTime,
  type MergeMode,
} from "./lineOps";
import {
  CUSTOM_STEP,
  DEFAULT_DURATION,
  MS_STEP,
  MIN_GAP,
  extendNextStartToSelected,
  extendPreviousEndToSelected,
  extendToNext,
  extendToPrevious,
  frameStep,
  heldCueEnd,
  nudgeEdge,
  placeHeldCue,
  setEndAndStartOfNext,
  setEndAt,
  setStartAndEndOfPrevious,
  setStartAt,
  shiftAll,
  shiftIndices,
  timesForUntimed,
  type Edge,
  type NudgeMode,
  type SetStartOpts,
} from "./timing";
import { hasOriginal, pairOriginalsByIndex, splitOriginalByWeight } from "./original";
import { plainTextLines } from "./plainText";
import type { Cue, CueData } from "./types";

export type { MergeMode };
export { hasOriginal };

/** Script-import cue that has not been given real start/end yet (SCR-01). */
export const isUntimed = (c: { untimed?: boolean }) => c.untimed === true;

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
  /** Path of the opened original/script file, if any (FIL-07). Not the translation. */
  originalPath: string | null;
  dirty: boolean;
  timecode: TimecodeMode;
  fps: number;
  /** Active rule profile for this project (RUL-01); saved in the sidecar. */
  ruleProfileId: string;
  past: HistoryEntry[];
  future: HistoryEntry[];
}

const HISTORY_LIMIT = 500;

let seq = 0;
const newId = () => `c${++seq}`;
const withIds = (cues: CueData[]): Cue[] => cues.map((c) => ({ ...c, id: newId() }));

export const useSubtitles = create<SubtitleState>()(() => ({
  cues: [],
  selectedId: null,
  selectedIds: [],
  selectionAnchor: null,
  filePath: null,
  videoPath: null,
  originalPath: null,
  dirty: false,
  timecode: "frames",
  fps: 25,
  ruleProfileId: "default",
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
/** Timed cue under playhead `t`. Untimed (SCR-01) cues are never matches. */
export function cueIndexAt(cues: readonly Cue[], t: number): number {
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i]!;
    if (isUntimed(c)) continue;
    if (t < c.start) return -1;
    if (t <= c.end) return i;
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
  if (/\.bookmark\b|bookmark$/.test(joined)) return "Bookmark";
  if (/\.original\b|original$/.test(joined)) return "Edit original";
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
    originalPath: null,
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
    originalPath: null,
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
  const prev = get().videoPath;
  set({ videoPath });
  // Shot list is per open video; clear when the path changes (sidecar restore may refill).
  if (prev !== videoPath) useMedia.setState({ shotChanges: null });
}

/** Known on-disk mtime (ms) for the open subtitle; used to detect external edits. */
let knownMtimeMs: number | null = null;

export function getKnownMtime() {
  return knownMtimeMs;
}

export function setKnownMtime(ms: number | null) {
  knownMtimeMs = ms;
}

export function setRuleProfileId(ruleProfileId: string) {
  set({ ruleProfileId });
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
    if (patch.start !== undefined || patch.end !== undefined) {
      delete cue.untimed;
      if (cue.end <= cue.start) cue.end = cue.start + DEFAULT_DURATION;
    }
    if (patch.start !== undefined) doc.cues.sort(byStart);
  }, key);
}

/** Set the text of many cues by id in one undo step (find & replace all). */
export function setCueTexts(texts: ReadonlyMap<string, string>) {
  if (!texts.size) return;
  edit((doc) => {
    for (const cue of doc.cues) {
      const text = texts.get(cue.id);
      if (text !== undefined) cue.text = text;
    }
  });
}

export interface TimeChange {
  id: string;
  start?: number;
  end?: number;
}

/**
 * Retime several cues in one undo step (waveform drags). Pass the same `key`
 * for every update of one gesture so the whole drag undoes at once.
 * Clears `untimed` when an imported script line gets real times (SCR-02).
 */
export function setCueTimes(changes: readonly TimeChange[], key?: string) {
  edit((doc) => {
    let moved = false;
    for (const ch of changes) {
      const cue = doc.cues.find((c) => c.id === ch.id);
      if (!cue) continue;
      const hadTimes = ch.start !== undefined || ch.end !== undefined;
      if (isUntimed(cue) && hadTimes) {
        if (ch.start !== undefined && ch.end !== undefined) {
          cue.start = Math.max(0, ch.start);
          cue.end = Math.max(cue.start + MIN_GAP, ch.end);
        } else if (ch.start !== undefined) {
          Object.assign(cue, timesForUntimed(ch.start, "start"));
        } else {
          Object.assign(cue, timesForUntimed(ch.end!, "end"));
        }
        delete cue.untimed;
        moved = true;
        continue;
      }
      if (ch.start !== undefined && cue.start !== ch.start) {
        cue.start = ch.start;
        moved = true;
      }
      if (ch.end !== undefined && cue.end !== ch.end) cue.end = ch.end;
      if (hadTimes) delete cue.untimed;
    }
    if (moved) doc.cues.sort(byStart);
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

/** Inserts an empty cue with exactly these times (sorted into place) and selects it. */
export function addCue(start: number, end: number, text = ""): string {
  const id = newId();
  edit((doc) => {
    let i = doc.cues.findIndex((c) => c.start > start);
    if (i === -1) i = doc.cues.length;
    doc.cues.splice(i, 0, { id, start, end, text });
  });
  select(id);
  return id;
}

/** Set the text of cue `index` and the one after it in one undo step (EDT-11 word moves). */
export function setPairTexts(index: number, first: string, second: string) {
  edit((doc) => {
    const a = doc.cues[index];
    const b = doc.cues[index + 1];
    if (!a || !b) return;
    a.text = first;
    b.text = second;
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

/**
 * Hold-to-time, key down (TIM-01 / SCR-02): if the selected cue is untimed,
 * assign it times at `t` (keeps its text). Otherwise insert a blank cue.
 * Pair with `endHeldCue`; both share one undo step.
 */
export function beginHeldCue(t: number): string {
  const i = primaryIndex();
  const selected = i >= 0 ? get().cues[i]! : null;
  if (selected && isUntimed(selected)) {
    const id = selected.id;
    edit((doc) => {
      const idx = doc.cues.findIndex((c) => c.id === id);
      if (idx < 0) return;
      const [cue] = doc.cues.splice(idx, 1);
      if (!cue) return;
      const at = placeHeldCue(doc.cues, t);
      cue.start = at.start;
      cue.end = at.end;
      delete cue.untimed;
      doc.cues.splice(at.index, 0, cue);
    }, `hold:${id}`);
    set({ selectedId: id, selectedIds: [id], selectionAnchor: id });
    return id;
  }

  const id = newId();
  edit((doc) => {
    const at = placeHeldCue(doc.cues, t);
    doc.cues.splice(at.index, 0, { id, start: at.start, end: at.end, text: "" });
  }, `hold:${id}`);
  // Set the selection directly: `select` would close the undo step we still extend.
  set({ selectedId: id, selectedIds: [id], selectionAnchor: id });
  return id;
}

/** Hold-to-time, key up: end the held cue at `t` and keep it selected. */
export function endHeldCue(id: string, t: number) {
  edit((doc) => {
    const i = doc.cues.findIndex((c) => c.id === id);
    if (i >= 0) doc.cues[i]!.end = heldCueEnd(doc.cues, i, t);
  }, `hold:${id}`);
  if (get().cues.some((c) => c.id === id)) select(id);
}

/** Id of the cue after the primary selection (script/list order), if any. */
export function nextCueIdAfterPrimary(): string | null {
  const i = primaryIndex();
  if (i < 0) return null;
  return get().cues[i + 1]?.id ?? null;
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

function applyUntimedTimes(c: Cue, t: number, edge: "start" | "end") {
  Object.assign(c, timesForUntimed(t, edge));
  delete c.untimed;
}

export function setSelectedStartAt(t: number, opts?: SetStartOpts) {
  const i = primaryIndex();
  if (i < 0) return;
  edit((doc) => {
    const c = doc.cues[i]!;
    if (isUntimed(c)) {
      applyUntimedTimes(c, t, "start");
      doc.cues.sort(byStart);
      return;
    }
    setStartAt(doc.cues, i, t, opts);
  });
}

export function setSelectedEndAt(t: number) {
  const i = primaryIndex();
  if (i < 0) return;
  edit((doc) => {
    const c = doc.cues[i]!;
    if (isUntimed(c)) {
      applyUntimedTimes(c, t, "end");
      doc.cues.sort(byStart);
      return;
    }
    setEndAt(doc.cues, i, t);
  });
}

/**
 * Set end at `t`, then select the next cue in list order (id captured before
 * sort — required for the SCR-02 timing pass over untimed lines).
 */
export function setEndAndGoToNext(t: number) {
  const i = primaryIndex();
  if (i < 0) return;
  const nextId = get().cues[i + 1]?.id ?? null;
  edit((doc) => {
    const c = doc.cues[i]!;
    if (isUntimed(c)) {
      applyUntimedTimes(c, t, "end");
      doc.cues.sort(byStart);
      return;
    }
    setEndAt(doc.cues, i, t);
  });
  if (nextId) select(nextId);
}

/**
 * Set start at `t`, then select the next cue in list order (id before sort).
 */
export function setStartAndGoToNext(t: number, opts?: SetStartOpts) {
  const i = primaryIndex();
  if (i < 0) return;
  const nextId = get().cues[i + 1]?.id ?? null;
  edit((doc) => {
    const c = doc.cues[i]!;
    if (isUntimed(c)) {
      applyUntimedTimes(c, t, "start");
      doc.cues.sort(byStart);
      return;
    }
    setStartAt(doc.cues, i, t, opts);
  });
  if (nextId) select(nextId);
}

/**
 * Set end at `t`, insert a new cue after the minimum gap, select it.
 * On an untimed script line (SCR-02): set end and go to next — no blank insert.
 * Returns the new cue id, or null if nothing was selected / no insert.
 */
export function setEndAddNewAndGoToNew(t: number): string | null {
  const i = primaryIndex();
  if (i < 0) return null;
  if (isUntimed(get().cues[i]!)) {
    setEndAndGoToNext(t);
    return null;
  }
  let newIdOut: string | null = null;
  edit((doc) => {
    setEndAt(doc.cues, i, t);
    const cur = doc.cues[i]!;
    const start = cur.end + MIN_GAP;
    const next = doc.cues[i + 1];
    let end = start + DEFAULT_DURATION;
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
  const shots = useMedia.getState().shotChanges;
  edit((doc) => extendToPrevious(doc.cues, i, undefined, shots));
}

export function extendSelectedToNext() {
  const i = primaryIndex();
  if (i < 0) return;
  const shots = useMedia.getState().shotChanges;
  edit((doc) => extendToNext(doc.cues, i, undefined, shots));
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
  const times = useMedia.getState().frameTimes;
  edit((doc) => snapAllToSourceFrames(doc.cues, times, fps));
}

/** Snap selected cue edges to nearest shot changes (SYN-04). One undo step. */
export function snapSelectedToShotChanges(maxDist = 0.5): number {
  const shots = useMedia.getState().shotChanges;
  if (!shots?.length) return 0;
  const { selectedIds } = get();
  if (!selectedIds.length) return 0;
  const ids = new Set(selectedIds);
  let n = 0;
  edit((doc) => {
    for (const c of doc.cues) {
      if (!ids.has(c.id) || c.untimed) continue;
      const before = { start: c.start, end: c.end };
      snapCueToShots(c, shots, maxDist);
      if (c.start !== before.start || c.end !== before.end) n++;
    }
  });
  return n;
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

/**
 * Replace the document with untimed cues from plain text (SCR-01).
 * Keeps video by default; clears path and history (like opening a new file).
 */
export function replaceWithPlainText(text: string, keepVideo = true): number {
  const lines = plainTextLines(text);
  const cues: Cue[] = lines.map((line) => ({
    id: newId(),
    start: 0,
    end: 0,
    text: line,
    untimed: true,
  }));
  const id = cues[0]?.id ?? null;
  set({
    cues,
    selectedId: id,
    selectedIds: id ? [id] : [],
    selectionAnchor: id,
    filePath: null,
    dirty: true,
    past: [],
    future: [],
    ...(keepVideo ? {} : { videoPath: null }),
  });
  return cues.length;
}

/**
 * Insert untimed cues from plain text after the primary selection (or at end).
 * Undoable. Returns how many lines were added.
 */
export function insertPlainText(text: string): number {
  const lines = plainTextLines(text);
  if (!lines.length) return 0;
  const s = get();
  const primary = primaryIndex();
  const anchor = primary >= 0 ? s.cues[primary]! : s.cues.at(-1);
  const base = anchor ? anchor.end : 0;
  const at = primary >= 0 ? primary + 1 : s.cues.length;
  const ids = lines.map(() => newId());
  edit((doc) => {
    const added: Cue[] = lines.map((line, i) => ({
      id: ids[i]!,
      start: base,
      end: base,
      text: line,
      untimed: true,
    }));
    doc.cues.splice(at, 0, ...added);
    doc.cues.sort(byStart);
  });
  setSelection(ids, ids[0]!, ids[0]!);
  return lines.length;
}

function insertFitted(after: number, before: number | null, duration = DEFAULT_DURATION): string | null {
  const fit = fitCueInGap(after, before, duration);
  if (!fit) return null;
  const id = newId();
  edit((doc) => {
    let i = doc.cues.findIndex((c) => c.start > fit.start);
    if (i === -1) i = doc.cues.length;
    doc.cues.splice(i, 0, { id, start: fit.start, end: fit.end, text: "" });
  });
  select(id);
  return id;
}

/** Make room from `fromIndex` onward so a cue of `duration` fits starting at `after`. */
function insertWithPush(fromIndex: number, after: number, duration = DEFAULT_DURATION): string {
  const id = newId();
  const needEnd = after + duration;
  edit((doc) => {
    const blocker = doc.cues[fromIndex];
    if (blocker && blocker.start < needEnd + MIN_GAP) {
      const shift = needEnd + MIN_GAP - blocker.start;
      for (let j = fromIndex; j < doc.cues.length; j++) {
        doc.cues[j]!.start += shift;
        doc.cues[j]!.end += shift;
      }
    }
    doc.cues.splice(fromIndex, 0, { id, start: after, end: after + duration, text: "" });
  });
  select(id);
  return id;
}

/** Insert an empty cue in the gap before the primary selection. */
export function insertBeforeSelected(): string | null {
  const i = primaryIndex();
  if (i < 0) return null;
  const s = get();
  const cur = s.cues[i]!;
  const prev = s.cues[i - 1];
  const after = prev ? prev.end + MIN_GAP : 0;
  return insertFitted(after, cur.start) ?? insertWithPush(i, after);
}

/** Insert an empty cue in the gap after the primary selection. */
export function insertAfterSelected(): string | null {
  const i = primaryIndex();
  if (i < 0) return insertAtEnd();
  const s = get();
  const cur = s.cues[i]!;
  const next = s.cues[i + 1];
  const after = cur.end + MIN_GAP;
  return insertFitted(after, next ? next.start : null) ?? insertWithPush(i + 1, after);
}

/** Insert an empty cue after the last line (or at 0 if empty). */
export function insertAtEnd(): string {
  const s = get();
  const last = s.cues.at(-1);
  return insertFitted(last ? last.end + MIN_GAP : 0, null) ?? insertCue(last ? last.end + MIN_GAP : 0);
}

/** Delete the current selection (no ripple). */
export function deleteSelected() {
  const ids = get().selectedIds;
  if (!ids.length) return;
  removeCues(ids);
}

/**
 * Delete selected cues and shift later cues earlier by the deleted span
 * so the hole closes (Subtitle Edit "ripple delete").
 */
export function rippleDeleteSelected() {
  const indices = selectedIndices();
  if (!indices.length) return;
  const s = get();
  const lo = Math.min(...indices);
  const amount = rippleSpan(s.cues, indices);
  const remove = new Set(indices.map((i) => s.cues[i]!.id));
  let neighbour: string | null = null;
  for (let i = lo + 1; i < s.cues.length; i++) {
    if (!remove.has(s.cues[i]!.id)) {
      neighbour = s.cues[i]!.id;
      break;
    }
  }
  if (!neighbour) {
    for (let i = lo - 1; i >= 0; i--) {
      if (!remove.has(s.cues[i]!.id)) {
        neighbour = s.cues[i]!.id;
        break;
      }
    }
  }
  const afterIds = s.cues.filter((c, i) => i > Math.max(...indices) && !remove.has(c.id)).map((c) => c.id);
  edit((doc) => {
    doc.cues = doc.cues.filter((c) => !remove.has(c.id));
    if (!amount) return;
    const shift = new Set(afterIds);
    for (const c of doc.cues) {
      if (!shift.has(c.id)) continue;
      c.start = Math.max(0, c.start - amount);
      c.end = Math.max(c.start + MIN_GAP, c.end - amount);
    }
  });
  select(neighbour);
}

/** Duplicate the selected block immediately after it, preserving relative timing. */
export function duplicateSelected() {
  const indices = selectedIndices();
  if (!indices.length) return;
  const s = get();
  const block = indices.map((i) => s.cues[i]!);
  const first = block[0]!;
  const last = block[block.length - 1]!;
  const offset = last.end + MIN_GAP - first.start;
  const ids = block.map(() => newId());
  edit((doc) => {
    const insertAt = Math.max(...indices) + 1;
    const copies = block.map((c, j) => {
      const copy: Cue = {
        id: ids[j]!,
        start: c.start + offset,
        end: c.end + offset,
        text: c.text,
      };
      if (hasOriginal(c)) copy.original = c.original;
      return copy;
    });
    doc.cues.splice(insertAt, 0, ...copies);
  });
  setSelection(ids, ids[0]!, ids[0]!);
}

/** Remove cues whose text is empty/whitespace. */
export function removeBlankLines() {
  const blanks = get().cues.filter((c) => !c.text.trim()).map((c) => c.id);
  if (!blanks.length) return;
  removeCues(blanks);
}

/** Split the primary cue at the text caret; times follow character weight. */
export function splitSelectedAtCursor(cursor: number): string | null {
  const i = primaryIndex();
  if (i < 0) return null;
  const cue = get().cues[i]!;
  const parts = splitCueAtCursor(cue, cursor);
  if (!parts) return null;
  const [leftOrig, rightOrig] = splitOriginalByWeight(
    cue.original,
    parts.left.text.length,
    parts.right.text.length,
  );
  const rightId = newId();
  edit((doc) => {
    const c = doc.cues[i]!;
    c.end = parts.left.end;
    c.text = parts.left.text;
    if (leftOrig !== undefined) c.original = leftOrig;
    else delete c.original;
    const right: Cue = { id: rightId, ...parts.right };
    if (rightOrig !== undefined) right.original = rightOrig;
    doc.cues.splice(i + 1, 0, right);
  });
  select(rightId);
  return rightId;
}

/** Split the primary cue at `t`; all text stays on the left, right is empty. */
export function splitSelectedAtTime(t: number): string | null {
  const i = primaryIndex();
  if (i < 0) return null;
  const cue = get().cues[i]!;
  const parts = splitCueAtTime(cue, t, cue.text, "");
  if (!parts) return null;
  const rightId = newId();
  edit((doc) => {
    const c = doc.cues[i]!;
    c.end = parts.left.end;
    c.text = parts.left.text;
    const right: Cue = { id: rightId, ...parts.right };
    // Keep the script on the timed-left half; empty original on the new right if mode is on.
    if (hasOriginal(cue)) right.original = "";
    doc.cues.splice(i + 1, 0, right);
  });
  select(rightId);
  return rightId;
}

function mergePair(i: number, neighbor: number, mode: MergeMode): string | null {
  const s = get();
  const a = s.cues[Math.min(i, neighbor)];
  const b = s.cues[Math.max(i, neighbor)];
  if (!a || !b || Math.abs(i - neighbor) !== 1) return null;
  const keepId = a.id;
  const dropId = b.id;
  edit((doc) => {
    const left = doc.cues.find((c) => c.id === keepId)!;
    const right = doc.cues.find((c) => c.id === dropId)!;
    left.text = mergeTexts(left.text, right.text, mode);
    if (hasOriginal(left) || hasOriginal(right)) {
      left.original = mergeTexts(left.original ?? "", right.original ?? "", mode);
    }
    left.end = right.end;
    doc.cues = doc.cues.filter((c) => c.id !== dropId);
  });
  select(keepId);
  return keepId;
}

export function mergeWithPrevious(mode: MergeMode = "keepBreaks") {
  const i = primaryIndex();
  if (i <= 0) return null;
  return mergePair(i, i - 1, mode);
}

export function mergeWithNext(mode: MergeMode = "keepBreaks") {
  const i = primaryIndex();
  if (i < 0 || i >= get().cues.length - 1) return null;
  return mergePair(i, i + 1, mode);
}

/** Merge a contiguous multi-selection into one cue. */
export function mergeSelected(mode: MergeMode = "keepBreaks") {
  const indices = selectedIndices();
  if (indices.length < 2) return mergeWithNext(mode);
  const lo = Math.min(...indices);
  const hi = Math.max(...indices);
  for (let i = lo; i < hi; i++) {
    if (!indices.includes(i)) return null; // non-contiguous
  }
  const s = get();
  const keepId = s.cues[lo]!.id;
  const block = indices.map((i) => s.cues[i]!);
  const drop = block.slice(1).map((c) => c.id);
  const text = mergeMany(
    block.map((c) => c.text),
    mode,
  );
  const anyOriginal = block.some(hasOriginal);
  const original = anyOriginal
    ? mergeMany(
        block.map((c) => c.original ?? ""),
        mode,
      )
    : undefined;
  const end = block[block.length - 1]!.end;
  edit((doc) => {
    const keep = doc.cues.find((c) => c.id === keepId)!;
    keep.text = text;
    keep.end = end;
    if (original !== undefined) keep.original = original;
    const remove = new Set(drop);
    doc.cues = doc.cues.filter((c) => !remove.has(c.id));
  });
  select(keepId);
  return keepId;
}

/* ---------- bookmarks (NAV-02) ---------- */

/** Bookmark the primary cue, or remove its bookmark (and note). One undo step. */
export function toggleBookmark(id = get().selectedId): boolean | null {
  const cue = get().cues.find((c) => c.id === id);
  if (!cue) return null;
  const on = cue.bookmark === undefined;
  edit((doc) => {
    const c = doc.cues.find((x) => x.id === id);
    if (!c) return;
    if (on) c.bookmark = "";
    else delete c.bookmark;
  });
  return on;
}

/** Sets (and creates, if needed) the bookmark note on a cue. */
export function setBookmarkNote(id: string, note: string) {
  edit((doc) => {
    const c = doc.cues.find((x) => x.id === id);
    if (c && c.bookmark !== note) c.bookmark = note;
  });
}

export function removeBookmark(id: string) {
  edit((doc) => {
    const c = doc.cues.find((x) => x.id === id);
    if (c && c.bookmark !== undefined) delete c.bookmark;
  });
}

/** Restores bookmarks by cue index (e.g. from the project sidecar) without an undo step. */
export function restoreBookmarks(marks: ReadonlyMap<number, string>) {
  if (!marks.size) return;
  set((s) => ({
    cues: s.cues.map((c, i) => (marks.has(i) ? { ...c, bookmark: marks.get(i)! } : c)),
  }));
}

/* ---------- original / script column (FIL-07) ---------- */

export const selectHasOriginals = (s: SubtitleState) => s.cues.some(hasOriginal);

/** Pair script lines onto cues by index. One undo step. */
export function applyOriginals(lines: readonly string[], path: string | null = null) {
  const paired = pairOriginalsByIndex(get().cues.length, lines);
  edit((doc) => {
    doc.cues.forEach((c, i) => {
      const text = paired[i];
      if (text !== undefined) c.original = text;
      else delete c.original;
    });
  });
  set({ originalPath: path });
}

/** Remove the original column from every cue. One undo step. */
export function clearOriginals() {
  if (!selectHasOriginals(get())) {
    if (get().originalPath) set({ originalPath: null });
    return;
  }
  edit((doc) => {
    for (const c of doc.cues) delete c.original;
  });
  set({ originalPath: null });
}

/** Edit one cue's original text (typing merges via `key`). */
export function updateOriginal(id: string, text: string, key?: string) {
  edit((doc) => {
    const cue = doc.cues.find((c) => c.id === id);
    if (!cue || cue.original === text) return;
    cue.original = text;
  }, key);
}

/** Restores originals by cue index from the sidecar without an undo step. */
export function restoreOriginals(texts: ReadonlyMap<number, string>, path: string | null = null) {
  if (!texts.size && !path) return;
  set((s) => ({
    originalPath: path,
    cues: s.cues.map((c, i) => (texts.has(i) ? { ...c, original: texts.get(i)! } : c)),
  }));
}
