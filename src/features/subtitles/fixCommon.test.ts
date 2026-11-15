import { describe, expect, it } from "vitest";
import { defaultFixIds, fixCommonErrors } from "./fixCommon";

describe("fixCommonErrors", () => {
  it("fixes double spaces, OCR ellipsis, overlaps and empty lines", () => {
    const { cues, hits } = fixCommonErrors(
      [
        { start: 0, end: 2, text: "Hello    world...." },
        { start: 1.5, end: 3, text: "  Overlap  " },
        { start: 4, end: 5, text: "   " },
      ],
      defaultFixIds(),
    );
    expect(cues).toHaveLength(2);
    expect(cues[0]!.text).toContain("Hello world");
    expect(cues[0]!.text).toContain("…");
    expect(cues[1]!.start).toBeGreaterThanOrEqual(cues[0]!.end);
    expect(hits.length).toBeGreaterThan(0);
  });

  it("normalizes dialog dashes when enabled", () => {
    const { cues } = fixCommonErrors(
      [{ start: 0, end: 2, text: "Hi\nThere" }],
      ["dialogDashes"],
    );
    expect(cues[0]!.text).toBe("- Hi\n- There");
  });
});
