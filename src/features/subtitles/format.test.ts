import { describe, expect, it } from "vitest";
import { formatRuns, gapAfter, stripTags, toggleItalic } from "./format";

describe("stripTags", () => {
  it("removes html-like tags", () => {
    expect(stripTags("<i>Hello</i> <b>there</b>")).toBe("Hello there");
  });
});

describe("formatRuns", () => {
  it("marks italic and bold spans", () => {
    expect(formatRuns("Say <i>hello</i> <b>now</b>")).toEqual([
      { text: "Say " },
      { text: "hello", italic: true },
      { text: " " },
      { text: "now", bold: true },
    ]);
  });

  it("handles nested italic+bold", () => {
    expect(formatRuns("<b><i>both</i></b>")).toEqual([{ text: "both", italic: true, bold: true }]);
  });
});

describe("gapAfter", () => {
  it("returns null without a previous cue", () => {
    expect(gapAfter(undefined, { start: 1 })).toBeNull();
  });

  it("returns the gap in seconds", () => {
    expect(gapAfter({ end: 1 }, { start: 1.5 })).toBeCloseTo(0.5);
  });
});

describe("toggleItalic", () => {
  it("wraps a selection and unwraps when tags are present", () => {
    expect(toggleItalic("Say hello", 4, 9)).toEqual({ text: "Say <i>hello</i>", start: 4, end: 16 });
    expect(toggleItalic("Say <i>hello</i>", 4, 16)).toEqual({ text: "Say hello", start: 4, end: 9 });
  });

  it("toggles the whole cue when the selection is empty", () => {
    expect(toggleItalic("Hello", 2, 2)).toEqual({ text: "<i>Hello</i>", start: 0, end: 12 });
  });
});
