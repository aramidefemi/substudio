import { describe, expect, it } from "vitest";
import { removeHearingImpaired, removeHearingImpairedText } from "./removeHi";

describe("removeHearingImpairedText", () => {
  it("strips brackets, parentheses, music and speaker labels", () => {
    expect(removeHearingImpairedText("[door slam] Hello")).toBe("Hello");
    expect(removeHearingImpairedText("(sighs) Okay")).toBe("Okay");
    expect(removeHearingImpairedText("♪ la la ♪")).toBe("");
    expect(removeHearingImpairedText("AMA: Wait")).toBe("Wait");
    expect(removeHearingImpairedText("BODE - Come")).toBe("Come");
  });

  it("keeps dialog when options are off", () => {
    expect(
      removeHearingImpairedText("[sfx] Hi", {
        brackets: false,
        parentheses: true,
        music: true,
        speakerColon: true,
        dropEmpty: true,
      }),
    ).toBe("[sfx] Hi");
  });
});

describe("removeHearingImpaired", () => {
  it("drops emptied cues by default", () => {
    const out = removeHearingImpaired([
      { start: 0, end: 1, text: "[music]" },
      { start: 1, end: 2, text: "Stay" },
    ]);
    expect(out).toEqual([{ start: 1, end: 2, text: "Stay" }]);
  });
});
