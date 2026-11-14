import { describe, expect, it } from "vitest";
import { formatRuns, gapAfter, stripTags } from "./format";

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
