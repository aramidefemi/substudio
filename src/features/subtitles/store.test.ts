import { beforeEach, describe, expect, it } from "vitest";
import { insertCue, loadDocument, redo, select, undo, updateCue, useSubtitles } from "./store";

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
