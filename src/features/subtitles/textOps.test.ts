import { describe, expect, it } from "vitest";
import {
  autoBreak,
  balanceLines,
  breakAtFirstSpace,
  toggleDialogDashes,
  toggleLineBreak,
  trimWhitespace,
  unbreak,
} from "./textOps";

describe("unbreak", () => {
  it("joins lines with a single space", () => {
    expect(unbreak("Hello\nworld")).toBe("Hello world");
    expect(unbreak("  a  \n  b  ")).toBe("a b");
  });
});

describe("autoBreak", () => {
  it("leaves short text alone", () => {
    expect(autoBreak("Short line")).toBe("Short line");
  });

  it("breaks near the middle at a space", () => {
    const text = "This is a fairly long subtitle that needs a break somewhere sensible now";
    const out = autoBreak(text, 42);
    const [a, b] = out.split("\n");
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a!.length).toBeLessThanOrEqual(42);
    expect(b!.length).toBeLessThanOrEqual(42);
  });

  it("prefers dialog dash splits", () => {
    expect(autoBreak("I never said that. - Of course you did.")).toBe(
      "I never said that.\n- Of course you did.",
    );
  });
});

describe("balanceLines", () => {
  it("rebalances uneven two-line text", () => {
    const out = balanceLines("Hi\nthis is a much longer second line that should pull words up", 42);
    expect(out.includes("\n")).toBe(true);
    expect(unbreak(out).startsWith("Hi")).toBe(true);
  });
});

describe("toggleLineBreak", () => {
  it("inserts and removes a break at the caret", () => {
    expect(toggleLineBreak("Hello world", 5)).toEqual({ text: "Hello\nworld", cursor: 6 });
    expect(toggleLineBreak("Hello\nworld", 5)).toEqual({ text: "Hello world", cursor: 6 });
    expect(toggleLineBreak("Hello\nworld", 6)).toEqual({ text: "Hello world", cursor: 6 });
  });
});

describe("breakAtFirstSpace", () => {
  it("breaks at the next space and advances the caret", () => {
    expect(breakAtFirstSpace("one two three", 0)).toEqual({ text: "one\ntwo three", cursor: 4 });
    expect(breakAtFirstSpace("one", 0)).toBeNull();
  });
});

describe("toggleDialogDashes", () => {
  it("adds and removes dashes on each line", () => {
    expect(toggleDialogDashes("Hello\nWorld")).toBe("- Hello\n- World");
    expect(toggleDialogDashes("- Hello\n- World")).toBe("Hello\nWorld");
  });

  it("keeps leading italic tags when adding", () => {
    expect(toggleDialogDashes("<i>Hello</i>")).toBe("<i>- Hello</i>");
  });
});

describe("trimWhitespace", () => {
  it("trims each line and outer blanks", () => {
    expect(trimWhitespace("  a  \n  b  \n")).toBe("a\nb");
  });
});
