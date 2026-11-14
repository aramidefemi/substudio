import { describe, expect, it } from "vitest";
import {
  buildMatcher,
  countMatches,
  findFrom,
  findMatches,
  replaceAll,
  replaceAt,
  replaceInText,
  type SearchOptions,
} from "./search";

const opts = (query: string, o: Partial<SearchOptions> = {}): SearchOptions => ({
  query,
  matchCase: false,
  wholeWord: false,
  regex: false,
  ...o,
});

const re = (query: string, o: Partial<SearchOptions> = {}) => {
  const m = buildMatcher(opts(query, o));
  if (!m || !m.ok) throw new Error("expected a matcher");
  return m.re;
};

describe("buildMatcher", () => {
  it("returns null for an empty query", () => {
    expect(buildMatcher(opts(""))).toBeNull();
  });

  it("reports a bad regex instead of throwing", () => {
    const m = buildMatcher(opts("(unclosed", { regex: true }));
    expect(m?.ok).toBe(false);
    if (m && !m.ok) expect(m.error).toMatch(/\S/);
    expect(buildMatcher(opts("[a-", { regex: true }))?.ok).toBe(false);
  });

  it("treats regex characters literally when regex is off", () => {
    expect(findMatches("Is it 2.5? Yes (really).", re("(really)."))).toEqual([{ start: 15, end: 24 }]);
    expect(findMatches("a.b axb", re("a.b"))).toHaveLength(1);
  });
});

describe("findMatches", () => {
  it("ignores case unless asked", () => {
    expect(findMatches("Mama, mama!", re("mama"))).toHaveLength(2);
    expect(findMatches("Mama, mama!", re("mama", { matchCase: true }))).toEqual([{ start: 6, end: 10 }]);
  });

  it("matches whole words only, keeping Yoruba tone marks inside words", () => {
    expect(findMatches("Amen. Amena said amen", re("amen", { wholeWord: true }))).toEqual([
      { start: 0, end: 4 },
      { start: 17, end: 21 },
    ]);
    // "ọmọ" followed by a combining grave accent is a different word from "ọmọ".
    const text = "ọmọ̀ ọmọ";
    expect(findMatches(text, re("ọmọ", { wholeWord: true }))).toEqual([{ start: text.lastIndexOf("ọmọ"), end: text.length }]);
  });

  it("supports regex with whole word", () => {
    expect(findMatches("cat catalog cats", re("cats?", { regex: true, wholeWord: true }))).toEqual([
      { start: 0, end: 3 },
      { start: 12, end: 16 },
    ]);
  });

  it("skips empty regex matches", () => {
    expect(findMatches("abc", re("x*", { regex: true }))).toEqual([]);
  });
});

describe("findFrom", () => {
  const texts = ["God will make a way.", "No match", "God is good. God!"];
  const god = re("god", { wholeWord: true });

  it("finds the next match from a position", () => {
    expect(findFrom(texts, god, { index: 0, offset: 0 }, 1)).toMatchObject({ index: 0, start: 0, wrapped: false });
    expect(findFrom(texts, god, { index: 0, offset: 1 }, 1)).toMatchObject({ index: 2, start: 0 });
    expect(findFrom(texts, god, { index: 2, offset: 1 }, 1)).toMatchObject({ index: 2, start: 13 });
  });

  it("wraps past the end and the start", () => {
    expect(findFrom(texts, god, { index: 2, offset: 14 }, 1)).toMatchObject({ index: 0, start: 0, wrapped: true });
    expect(findFrom(texts, god, { index: 0, offset: 0 }, -1)).toMatchObject({ index: 2, start: 13, wrapped: true });
    expect(findFrom(texts, god, { index: 2, offset: 13 }, -1)).toMatchObject({ index: 2, start: 0, wrapped: false });
  });

  it("comes back to the only match in the starting cue", () => {
    expect(findFrom(["one two"], re("one"), { index: 0, offset: 1 }, 1)).toMatchObject({ index: 0, start: 0, wrapped: true });
  });

  it("returns null when nothing matches", () => {
    expect(findFrom(texts, re("Jesus"), { index: 1, offset: 0 }, 1)).toBeNull();
    expect(findFrom([], god, { index: 0, offset: 0 }, 1)).toBeNull();
    expect(countMatches(texts, god)).toBe(3);
  });
});

describe("replace", () => {
  it("replaces literally when regex is off", () => {
    expect(replaceInText("cost $5", re("$5"), "$1 & $&", false)).toEqual({ text: "cost $1 & $&", count: 1 });
  });

  it("expands groups in regex mode", () => {
    expect(replaceInText("Mama said", re("(\\w+) (\\w+)", { regex: true }), "$2 $1", true).text).toBe("said Mama");
    expect(replaceInText("a\nb", re("^", { regex: true }), "- ", true).text).toBe("- a\nb");
  });

  it("replaces only the current match, using the surrounding text for whole words", () => {
    const god = re("god", { wholeWord: true });
    expect(replaceAt("God is good. God!", god, { start: 13, end: 16 }, "Olúwa", false)).toBe("God is good. Olúwa!");
    expect(replaceAt("goddess god", god, { start: 0, end: 3 }, "x", false)).toBeNull();
    expect(replaceAt("x 12", re("(\\d)(\\d)", { regex: true }), { start: 2, end: 4 }, "$2$1", true)).toBe("x 21");
  });

  it("collects replace-all changes with a total count", () => {
    const { changes, count } = replaceAll(["Mama, mama", "none", "mama"], re("mama"), "Iya", false);
    expect(count).toBe(3);
    expect([...changes]).toEqual([
      [0, "Iya, Iya"],
      [2, "Iya"],
    ]);
  });
});
