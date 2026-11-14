import { describe, expect, it } from "vitest";
import { findEmpty, findError, lineFromVideo, parseLineNumber } from "./navigation";
import type { CueData } from "./types";

const cue = (start: number, end: number, text = "Fine."): CueData => ({ start, end, text });

describe("findError", () => {
  // 1: too short, 3: overlaps 2
  const cues = [cue(0, 2), cue(3, 3.2), cue(4, 6), cue(5.5, 8), cue(9, 11)];

  it("finds the next and previous flagged line", () => {
    expect(findError(cues, 0, 1)).toBe(1);
    expect(findError(cues, 1, 1)).toBe(3);
    expect(findError(cues, 3, 1)).toBe(-1);
    expect(findError(cues, 4, -1)).toBe(3);
    expect(findError(cues, 1, -1)).toBe(-1);
  });

  it("starts from the top when nothing is selected", () => {
    expect(findError(cues, -1, 1)).toBe(1);
    expect(findError(cues, -1, -1)).toBe(-1);
  });
});

describe("findEmpty", () => {
  it("finds the next blank line", () => {
    const cues = [cue(0, 2, ""), cue(3, 5), cue(6, 8, "  \n "), cue(9, 11)];
    expect(findEmpty(cues, 0)).toBe(2);
    expect(findEmpty(cues, -1)).toBe(0);
    expect(findEmpty(cues, 2)).toBe(-1);
  });
});

describe("lineFromVideo", () => {
  const cues = [cue(1, 2), cue(3, 4), cue(5, 6)];

  it("finds the next line after the playhead", () => {
    expect(lineFromVideo(cues, 0, 1)).toBe(0);
    expect(lineFromVideo(cues, 3, 1)).toBe(2); // on line 1's start: go to the following one
    expect(lineFromVideo(cues, 3.5, 1)).toBe(2);
    expect(lineFromVideo(cues, 5.5, 1)).toBe(-1);
  });

  it("goes back to the current line's start first, then further", () => {
    expect(lineFromVideo(cues, 3.5, -1)).toBe(1);
    expect(lineFromVideo(cues, 3, -1)).toBe(0);
    expect(lineFromVideo(cues, 1, -1)).toBe(-1);
  });
});

describe("parseLineNumber", () => {
  it("turns a 1-based line number into an index", () => {
    expect(parseLineNumber("1", 10)).toBe(0);
    expect(parseLineNumber(" 12 ", 20)).toBe(11);
    expect(parseLineNumber("#3", 20)).toBe(2);
  });

  it("clamps past the end and rejects anything else", () => {
    expect(parseLineNumber("99", 10)).toBe(9);
    expect(parseLineNumber("0", 10)).toBeNull();
    expect(parseLineNumber("-2", 10)).toBeNull();
    expect(parseLineNumber("1.5", 10)).toBeNull();
    expect(parseLineNumber("abc", 10)).toBeNull();
    expect(parseLineNumber("", 10)).toBeNull();
    expect(parseLineNumber("1", 0)).toBeNull();
  });
});
