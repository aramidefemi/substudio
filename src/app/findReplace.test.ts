import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadDocument, select, undo, useSubtitles } from "@/features/subtitles/store";
import { findNext, replaceCurrent, replaceEverywhere, setSearch, useFindReplace } from "./findReplace";

// No DOM in these tests: no cue text box, so searches start from the selected cue.
vi.stubGlobal("requestAnimationFrame", () => 0);
vi.stubGlobal("document", { getElementById: () => null, activeElement: null });
vi.stubGlobal("HTMLTextAreaElement", class {});

const texts = () => useSubtitles.getState().cues.map((c) => c.text);
const ids = () => useSubtitles.getState().cues.map((c) => c.id);

beforeEach(() => {
  loadDocument(
    [
      { start: 0, end: 1, text: "Mama, come." },
      { start: 2, end: 3, text: "No." },
      { start: 4, end: 5, text: "mama said mama" },
    ],
    null,
  );
  useFindReplace.setState({ open: true, query: "", replacement: "", matchCase: false, wholeWord: false, regex: false, current: null, status: "" });
});

describe("find & replace", () => {
  it("replaces everything in one undo step", () => {
    setSearch({ query: "mama", replacement: "Ìyá" });
    replaceEverywhere();
    expect(texts()).toEqual(["Ìyá, come.", "No.", "Ìyá said Ìyá"]);
    expect(useFindReplace.getState().status).toBe("Replaced 3 matches in 2 lines");
    expect(useSubtitles.getState().past).toHaveLength(1);
    undo();
    expect(texts()).toEqual(["Mama, come.", "No.", "mama said mama"]);
  });

  it("steps through matches and wraps", () => {
    setSearch({ query: "mama" });
    findNext(1);
    expect(useSubtitles.getState().selectedId).toBe(ids()[0]);
    expect(useFindReplace.getState().status).toMatch(/^Match 1 of 3/);
    findNext(1);
    findNext(1);
    expect(useFindReplace.getState().current).toMatchObject({ cueId: ids()[2], start: 10 });
    findNext(1);
    expect(useFindReplace.getState().status).toMatch(/Match 1 of 3.*wrapped/);
    findNext(-1);
    expect(useFindReplace.getState().current).toMatchObject({ cueId: ids()[2], start: 10 });
  });

  it("replaces the current match and moves on", () => {
    setSearch({ query: "mama", matchCase: true, replacement: "mama mama" });
    select(ids()[2]!);
    findNext(1);
    replaceCurrent();
    expect(texts()[2]).toBe("mama mama said mama");
    // Continues after the inserted text, not inside it.
    expect(useFindReplace.getState().current).toMatchObject({ cueId: ids()[2], start: 15 });
  });

  it("reports a bad regex without changing anything", () => {
    setSearch({ query: "(mama", regex: true, replacement: "x" });
    replaceEverywhere();
    expect(useFindReplace.getState().status).toMatch(/^Invalid regular expression/);
    expect(texts()[0]).toBe("Mama, come.");
    expect(findNext(1)).toBe(false);
  });
});
