import { describe, expect, it } from "vitest";
import {
  changeCasing,
  mergeSameText,
  mergeSameTime,
  mergeShortLines,
} from "./casing";

describe("changeCasing", () => {
  it("handles modes without breaking tags", () => {
    expect(changeCasing("<i>Hello</i> WORLD", "lower")).toBe("<i>hello</i> world");
    expect(changeCasing("hello world", "upper")).toBe("HELLO WORLD");
    expect(changeCasing("hello world. next", "sentence")).toBe("Hello world. Next");
    expect(changeCasing("the lord of the rings", "proper")).toBe("The Lord of the Rings");
  });
});

describe("merge helpers", () => {
  it("merges short consecutive lines", () => {
    const out = mergeShortLines(
      [
        { start: 0, end: 1, text: "Hi" },
        { start: 1.05, end: 2, text: "there" },
        { start: 5, end: 6, text: "Later line that is long enough" },
      ],
      12,
    );
    expect(out).toHaveLength(2);
    expect(out[0]!.text).toBe("Hi\nthere");
  });

  it("merges same text / same time", () => {
    expect(
      mergeSameText([
        { start: 0, end: 1, text: "Hello" },
        { start: 1.1, end: 2, text: "Hello" },
      ]),
    ).toEqual([{ start: 0, end: 2, text: "Hello" }]);

    expect(
      mergeSameTime([
        { start: 1, end: 2, text: "A" },
        { start: 1.01, end: 2.02, text: "B" },
      ]),
    ).toEqual([{ start: 1, end: 2, text: "A\nB" }]);
  });
});
