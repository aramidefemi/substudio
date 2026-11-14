import { describe, expect, it } from "vitest";
import { fitGuess } from "./speech";

const cue = { start: 2, end: 4 };

describe("fitGuess", () => {
  it("applies only the requested edges", () => {
    const guess = { start: 1.8, end: 4.2 };
    expect(fitGuess(cue, guess, "both")).toEqual({ start: 1.8, end: 4.2 });
    expect(fitGuess(cue, guess, "start")).toEqual({ start: 1.8 });
    expect(fitGuess(cue, guess, "end")).toEqual({ end: 4.2 });
  });

  it("skips edges with no guess", () => {
    expect(fitGuess(cue, { start: null, end: 3.9 }, "both")).toEqual({ end: 3.9 });
    expect(fitGuess(cue, { start: null, end: null }, "both")).toEqual({});
  });

  it("never crosses a neighbour", () => {
    const guess = { start: 1.5, end: 4.5 };
    expect(fitGuess(cue, guess, "both", { start: 0, end: 1.7 }, { start: 4.3, end: 5 })).toEqual({});
    expect(fitGuess(cue, guess, "both", { start: 0, end: 1.5 }, { start: 4.5, end: 5 })).toEqual({ start: 1.5, end: 4.5 });
  });

  it("keeps the minimum length", () => {
    expect(fitGuess(cue, { start: 3.95, end: null }, "start")).toEqual({});
  });
});
