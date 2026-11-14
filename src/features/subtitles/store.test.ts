import { beforeEach, describe, expect, it } from "vitest";
import {
  beginHeldCue,
  endHeldCue,
  deleteSelected,
  duplicateSelected,
  insertAfterSelected,
  insertAtEnd,
  insertBeforeSelected,
  insertCue,
  invertSelection,
  loadDocument,
  mergeSelected,
  mergeWithNext,
  mergeWithPrevious,
  moveSelectedBy,
  newDocument,
  nudgeSelectedEdgeBy,
  pasteCues,
  redo,
  removeBlankLines,
  removeCues,
  rippleDeleteSelected,
  select,
  selectAll,
  selectRangeTo,
  setEndAddNewAndGoToNew,
  setVideo,
  snapAllTimesToFrames,
  splitSelectedAtCursor,
  splitSelectedAtTime,
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

describe("line operations", () => {
  it("inserts before, after, and at end", () => {
    const [a] = useSubtitles.getState().cues;
    select(a!.id);
    insertBeforeSelected();
    expect(useSubtitles.getState().cues).toHaveLength(3);
    expect(useSubtitles.getState().cues[0]!.text).toBe("");
    select(useSubtitles.getState().cues[1]!.id);
    insertAfterSelected();
    expect(useSubtitles.getState().cues).toHaveLength(4);
    insertAtEnd();
    expect(useSubtitles.getState().cues.at(-1)!.text).toBe("");
  });

  it("deletes, duplicates, and ripple-deletes", () => {
    loadDocument(
      [
        { start: 0, end: 1, text: "A" },
        { start: 2, end: 3, text: "B" },
        { start: 4, end: 5, text: "C" },
      ],
      null,
    );
    const [a, b] = useSubtitles.getState().cues;
    select(a!.id);
    duplicateSelected();
    expect(texts()[1]).toBe("A");
    select(b!.id);
    deleteSelected();
    expect(texts()).toEqual(["A", "A", "C"]);

    loadDocument(
      [
        { start: 0, end: 1, text: "A" },
        { start: 2, end: 3, text: "B" },
        { start: 4, end: 5, text: "C" },
      ],
      null,
    );
    select(useSubtitles.getState().cues[1]!.id);
    rippleDeleteSelected();
    const s = useSubtitles.getState();
    expect(texts()).toEqual(["A", "C"]);
    // C moves earlier by B's span (end−start), not into B's former start.
    expect(s.cues[1]!.start).toBeCloseTo(3);
  });

  it("splits at cursor and at time", () => {
    const a = useSubtitles.getState().cues[0]!;
    updateCue(a.id, { text: "aa bb", end: 2 });
    select(a.id);
    splitSelectedAtCursor(2);
    expect(texts().slice(0, 2)).toEqual(["aa", "bb"]);

    loadDocument([{ start: 0, end: 4, text: "hello" }], null);
    const c = useSubtitles.getState().cues[0]!;
    select(c.id);
    splitSelectedAtTime(2);
    expect(useSubtitles.getState().cues[0]!.text).toBe("hello");
    expect(useSubtitles.getState().cues[1]!.text).toBe("");
    expect(useSubtitles.getState().cues[0]!.end).toBeCloseTo(2);
  });

  it("merges with next/previous and selected", () => {
    select(useSubtitles.getState().cues[0]!.id);
    mergeWithNext("keepBreaks");
    expect(texts()).toEqual(["A\nB"]);
    undo();
    select(useSubtitles.getState().cues[1]!.id);
    mergeWithPrevious("unbreak");
    expect(texts()).toEqual(["A B"]);

    loadDocument(
      [
        { start: 0, end: 1, text: "A" },
        { start: 2, end: 3, text: "B" },
        { start: 4, end: 5, text: "C" },
      ],
      null,
    );
    const cues = useSubtitles.getState().cues;
    select(cues[0]!.id);
    selectRangeTo(cues[2]!.id);
    mergeSelected("dialog");
    expect(texts()).toEqual(["- A\n- B\n- C"]);
  });

  it("removes blank lines", () => {
    loadDocument(
      [
        { start: 0, end: 1, text: "A" },
        { start: 2, end: 3, text: "  " },
        { start: 4, end: 5, text: "C" },
      ],
      null,
    );
    removeBlankLines();
    expect(texts()).toEqual(["A", "C"]);
  });
});

describe("hold-to-time", () => {
  const cues = () => useSubtitles.getState().cues;

  it("creates the cue on key down and ends it on key up, in one undo step", () => {
    const id = beginHeldCue(1.2);
    expect(useSubtitles.getState().selectedId).toBe(id);
    expect(cues().map((c) => c.id).indexOf(id)).toBe(1);
    expect(cues()[1]!.start).toBeCloseTo(1.2);
    endHeldCue(id, 2.5);
    expect(cues()[1]!.end).toBeCloseTo(2 - MIN_GAP); // clamped before "B" at 2 s
    expect(useSubtitles.getState().selectedId).toBe(id);
    undo();
    expect(texts()).toEqual(["A", "B"]);
  });

  it("uses the release time when there is room", () => {
    const id = beginHeldCue(4);
    endHeldCue(id, 5.5);
    const c = cues().find((x) => x.id === id)!;
    expect(c.start).toBe(4);
    expect(c.end).toBe(5.5);
  });

  it("ignores a release for a cue that no longer exists", () => {
    const id = beginHeldCue(4);
    undo();
    endHeldCue(id, 5);
    expect(texts()).toEqual(["A", "B"]);
  });
});
