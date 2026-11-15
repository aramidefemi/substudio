import { describe, expect, it } from "vitest";
import { plainTextLines, untimedCuesFromPlainText } from "./plainText";

describe("plainTextLines", () => {
  it("splits on line breaks and skips blanks", () => {
    expect(plainTextLines("A\n\nB\n  \nC\r\nD")).toEqual(["A", "B", "C", "D"]);
  });

  it("keeps leading spaces on a line but drops trailing", () => {
    expect(plainTextLines("  hello  \n\t\n")).toEqual(["  hello"]);
  });

  it("strips a BOM", () => {
    expect(plainTextLines("\uFEFFOne\nTwo")).toEqual(["One", "Two"]);
  });

  it("returns empty for whitespace-only", () => {
    expect(plainTextLines("\n  \n\t\n")).toEqual([]);
  });
});

describe("untimedCuesFromPlainText", () => {
  it("maps each line to a zero-duration cue", () => {
    expect(untimedCuesFromPlainText("Yo\nEn")).toEqual([
      { start: 0, end: 0, text: "Yo" },
      { start: 0, end: 0, text: "En" },
    ]);
  });
});
