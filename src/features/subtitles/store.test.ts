import { beforeEach, describe, expect, it } from "vitest";
import {
  insertCue,
  invertSelection,
  loadDocument,
  moveSelectedBy,
  newDocument,
  nudgeSelectedEdgeBy,
  pasteCues,
  redo,
  removeCues,
  select,
  selectAll,
  selectRangeTo,
  setEndAddNewAndGoToNew,
  setVideo,
  snapAllTimesToFrames,
  toggleSelect,
  restoreHistoryTo,
  undo,
  updateCue,
  useSubtitles,
} from "./store";
import { MIN_GAP } from "./timing";

const texts = () => useSubtitles.getState().cues.map((c) => c.text);

beforeEach(() => {
  loadDocument(
    [
      { start: 0, end: 1, text: "A" },
      { start: 2, end: 3, text: "B" },
    ],
    null,
  );
});

describe("undo history", () => {
  it("undoes and redoes an edit", () => {
    const id = useSubtitles.getState().cues[0]!.id;
    updateCue(id, { text: "A2" });
    expect(texts()).toEqual(["A2", "B"]);
    undo();
    expect(texts()).toEqual(["A", "B"]);
    redo();
    expect(texts()).toEqual(["A2", "B"]);
  });

  it("merges typing in one cue into a single step", () => {
    const id = useSubtitles.getState().cues[0]!.id;
    for (const t of ["H", "He", "Hey"]) updateCue(id, { text: t }, `text:${id}`);
    expect(useSubtitles.getState().past).toHaveLength(1);
    undo();
    expect(texts()).toEqual(["A", "B"]);
  });

  it("starts a new step after the selection changes", () => {
    const [a, b] = useSubtitles.getState().cues;
    updateCue(a!.id, { text: "x" }, `text:${a!.id}`);
    select(b!.id);
    select(a!.id);
    updateCue(a!.id, { text: "xy" }, `text:${a!.id}`);
    expect(useSubtitles.getState().past).toHaveLength(2);
  });

  it("restoreHistoryTo keeps older steps", () => {
    const id = useSubtitles.getState().cues[0]!.id;
    updateCue(id, { text: "1" });
    updateCue(id, { text: "2" });
    updateCue(id, { text: "3" });
    expect(useSubtitles.getState().past).toHaveLength(3);
    restoreHistoryTo(1);
    expect(texts()[0]).toBe("1");
    expect(useSubtitles.getState().past).toHaveLength(1);
  });
});

describe("document / video", () => {
  it("new and open clear video unless keepVideo", () => {
    setVideo("/film.mp4");
    newDocument();
    expect(useSubtitles.getState().videoPath).toBeNull();

    setVideo("/film.mp4");
    newDocument(true);
    expect(useSubtitles.getState().videoPath).toBe("/film.mp4");

    loadDocument([{ start: 0, end: 1, text: "x" }], "/a.srt");
    expect(useSubtitles.getState().videoPath).toBeNull();

    setVideo("/film.mp4");
    loadDocument([{ start: 0, end: 1, text: "y" }], "/b.srt", true);
    expect(useSubtitles.getState().videoPath).toBe("/film.mp4");
  });
});

describe("insertCue", () => {
  it("fits a new cue between neighbours and selects it", () => {
    const id = insertCue(1.2);
    const s = useSubtitles.getState();
    const cue = s.cues[1]!;
    expect(cue.id).toBe(id);
    expect(s.selectedId).toBe(id);
    expect(cue.end).toBeLessThanOrEqual(2);
  });

  it("keeps cues sorted when a start time moves", () => {
    const id = useSubtitles.getState().cues[0]!.id;
    updateCue(id, { start: 5, end: 6 });
    expect(texts()).toEqual(["B", "A"]);
  });
});

describe("multi-select", () => {
  it("toggles and ranges selection", () => {
    const [a, b] = useSubtitles.getState().cues;
    select(a!.id);
    toggleSelect(b!.id);
    expect(useSubtitles.getState().selectedIds).toEqual([a!.id, b!.id]);
    select(a!.id);
    selectRangeTo(b!.id);
    expect(useSubtitles.getState().selectedIds).toEqual([a!.id, b!.id]);
  });

  it("selects all and inverts", () => {
    selectAll();
    expect(useSubtitles.getState().selectedIds).toHaveLength(2);
    invertSelection();
    expect(useSubtitles.getState().selectedIds).toHaveLength(0);
  });

  it("removes and pastes cues", () => {
    const [a] = useSubtitles.getState().cues;
    removeCues([a!.id]);
    expect(texts()).toEqual(["B"]);
    pasteCues([{ start: 0.1, end: 0.5, text: "Z" }]);
    expect(texts()).toEqual(["Z", "B"]);
  });
});

describe("timing by keyboard", () => {
  it("nudges start by one frame and moves selected lines", () => {
    const a = useSubtitles.getState().cues[0]!;
    select(a.id);
    nudgeSelectedEdgeBy("start", "frame", 1);
    expect(useSubtitles.getState().cues[0]!.start).toBeCloseTo(1 / 25);
    moveSelectedBy("ms", 1);
    expect(useSubtitles.getState().cues[0]!.start).toBeCloseTo(1 / 25 + 0.1);
  });

  it("sets end, adds new, and selects the new cue", () => {
    const a = useSubtitles.getState().cues[0]!;
    select(a.id);
    const id = setEndAddNewAndGoToNew(0.5);
    const s = useSubtitles.getState();
    expect(id).toBeTruthy();
    expect(s.selectedId).toBe(id);
    expect(s.cues[0]!.end).toBeCloseTo(0.5);
    expect(s.cues[1]!.start).toBeCloseTo(0.5 + MIN_GAP);
  });

  it("snaps all times to frames", () => {
    const a = useSubtitles.getState().cues[0]!;
    updateCue(a.id, { start: 0.03, end: 1.07 });
    snapAllTimesToFrames();
    const c = useSubtitles.getState().cues[0]!;
    expect(c.start * 25).toBeCloseTo(Math.round(c.start * 25));
    expect(c.end * 25).toBeCloseTo(Math.round(c.end * 25));
  });
});
