import { describe, expect, it } from "vitest";
import { hasOriginal, pairOriginalsByIndex, splitOriginalByWeight } from "./original";

describe("pairOriginalsByIndex", () => {
  it("pairs by index and clears extras", () => {
    expect(pairOriginalsByIndex(3, ["a", "b"])).toEqual(["a", "b", undefined]);
    expect(pairOriginalsByIndex(2, ["a", "b", "c"])).toEqual(["a", "b"]);
  });
});

describe("splitOriginalByWeight", () => {
  it("leaves undefined alone", () => {
    expect(splitOriginalByWeight(undefined, 2, 2)).toEqual([undefined, undefined]);
  });

  it("splits empty into empty halves", () => {
    expect(splitOriginalByWeight("", 1, 1)).toEqual(["", ""]);
  });

  it("splits by character weight", () => {
    expect(splitOriginalByWeight("abcdefgh", 2, 6)).toEqual(["ab", "cdefgh"]);
  });
});

describe("hasOriginal", () => {
  it("treats empty string as present", () => {
    expect(hasOriginal({})).toBe(false);
    expect(hasOriginal({ original: "" })).toBe(true);
    expect(hasOriginal({ original: "yo" })).toBe(true);
  });
});
