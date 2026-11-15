import { describe, expect, it } from "vitest";
import { applyReplaceRules, applyReplaceSet, countRuleHits } from "./multipleReplace";

describe("multipleReplace", () => {
  it("applies chained rules", () => {
    expect(
      applyReplaceRules("colour colour", [
        { find: "colour", replace: "color" },
        { find: "color", replace: "clr", wholeWord: true },
      ]),
    ).toBe("clr clr");
  });

  it("counts and maps cues", () => {
    const cues = [{ start: 0, end: 1, text: "OK ok OK" }];
    expect(countRuleHits(cues, { find: "ok", replace: "", matchCase: false })).toBe(3);
    expect(applyReplaceSet(cues, [{ find: "OK", replace: "Yes", matchCase: true }])[0]!.text).toBe(
      "Yes ok Yes",
    );
  });
});
