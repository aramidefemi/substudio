import { describe, expect, it } from "vitest";
import { batchSummary, convertedName, defaultOutDir, mergePaths, parseOffsetMs } from "./batch";

describe("batch helpers", () => {
  it("names outputs after the input with the target extension", () => {
    expect(convertedName("/in/Ayinla.vtt", "srt")).toBe("Ayinla.srt");
    expect(convertedName("/in/a.b.srt", "dfxp")).toBe("a.b.dfxp");
    expect(convertedName("C:\\in\\x.sbv", "ass")).toBe("x.ass");
  });

  it("suggests a converted folder beside the first input", () => {
    expect(defaultOutDir(["/in/a.srt", "/other/b.srt"])).toBe("/in/converted");
    expect(defaultOutDir([])).toBe("");
  });

  it("parses the millisecond offset", () => {
    expect(parseOffsetMs("")).toBe(0);
    expect(parseOffsetMs(" -250 ")).toBe(-250);
    expect(parseOffsetMs("+1500")).toBe(1500);
    expect(parseOffsetMs("1.5")).toBeNull();
    expect(parseOffsetMs("abc")).toBeNull();
  });

  it("summarises outcomes", () => {
    expect(batchSummary({ ok: ["a"], failed: [] })).toBe("Converted 1 file");
    expect(batchSummary({ ok: ["a", "b"], failed: [] })).toBe("Converted 2 files");
    expect(batchSummary({ ok: ["a"], failed: [{ path: "x", error: "e" }] })).toBe("Converted 1, 1 failed");
  });

  it("merges picked paths without repeats", () => {
    expect(mergePaths(["/a", "/b"], ["/b", "/c"])).toEqual(["/a", "/b", "/c"]);
  });
});
