import { describe, expect, it } from "vitest";
import { parseCues, serializeCues } from "./clipboard";

describe("cue clipboard", () => {
  it("round-trips cues", () => {
    const cues = [
      { start: 0.32, end: 1.76, text: "My child" },
      { start: 2, end: 3, text: "Line\ntwo" },
    ];
    expect(parseCues(serializeCues(cues))).toEqual(cues);
  });

  it("parses plain SRT blocks", () => {
    const raw = "1\n00:00:01,000 --> 00:00:02,000\nHi\n\n2\n00:00:03,000 --> 00:00:04,500\nThere";
    expect(parseCues(raw)).toEqual([
      { start: 1, end: 2, text: "Hi" },
      { start: 3, end: 4.5, text: "There" },
    ]);
  });
});
