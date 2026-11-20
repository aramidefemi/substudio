import { describe, expect, it } from "vitest";
import type { Cue } from "@/features/subtitles/types";
import { buildPlan, chunk, finish, hasWords, isTranslated, prepare } from "./plan";

const cue = (id: string, text: string, original?: string): Cue => ({
  id,
  start: 0,
  end: 1,
  text,
  ...(original !== undefined ? { original } : {}),
});

describe("buildPlan", () => {
  it("seeds the original column when there is none and translates every line", () => {
    const plan = buildPlan([cue("a", "Ẹ kú àárọ̀"), cue("b", "Níbo lò ń lọ?")], { scope: null, skipTranslated: true });
    expect(plan.seedOriginals).toBe(true);
    expect(plan.items.map((i) => i.send)).toEqual(["Ẹ kú àárọ̀", "Níbo lò ń lọ?"]);
  });

  it("translates from the original column when it exists", () => {
    const plan = buildPlan([cue("a", "", "Ẹ kú àárọ̀"), cue("b", "", "")], { scope: null, skipTranslated: true });
    expect(plan.seedOriginals).toBe(false);
    expect(plan.items.map((i) => i.id)).toEqual(["a"]);
    expect(plan.skipped).toBe(1);
  });

  it("skips translated lines only when asked", () => {
    const cues = [cue("a", "Good morning", "Ẹ kú àárọ̀"), cue("b", "Níbo", "Níbo")];
    expect(buildPlan(cues, { scope: null, skipTranslated: true }).items.map((i) => i.id)).toEqual(["b"]);
    expect(buildPlan(cues, { scope: null, skipTranslated: false }).items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("respects the scope", () => {
    const plan = buildPlan([cue("a", "one"), cue("b", "two")], { scope: new Set(["b"]), skipTranslated: true });
    expect(plan.items.map((i) => i.id)).toEqual(["b"]);
    expect(plan.inScope).toBe(1);
  });

  it("leaves music-only and blank lines alone", () => {
    const plan = buildPlan([cue("a", "♪ ♪"), cue("b", "  "), cue("c", "♪ Ìfẹ́ mi ♪")], { scope: null, skipTranslated: true });
    expect(plan.items.map((i) => i.id)).toEqual(["c"]);
    expect(plan.skipped).toBe(2);
  });
});

describe("prepare", () => {
  it("unbreaks ordinary lines so Google sees the whole sentence", () => {
    expect(prepare("a", "Mo fẹ́ lọ sí ọjà\nní ọ̀la").send).toBe("Mo fẹ́ lọ sí ọjà ní ọ̀la");
  });

  it("keeps dialog lines apart", () => {
    const item = prepare("a", "- Báwo ni?\n- Dáadáa ni.");
    expect(item.dialog).toBe(true);
    expect(item.send).toBe("- Báwo ni?\n- Dáadáa ni.");
  });

  it("unwraps a whole-line italic", () => {
    const item = prepare("a", "<i>Ó ti lọ.</i>");
    expect(item).toMatchObject({ italic: true, send: "Ó ti lọ." });
    expect(prepare("a", "<i>a</i> b <i>c</i>").italic).toBe(false);
  });
});

describe("finish", () => {
  it("re-breaks long lines to the line length", () => {
    const item = prepare("a", "x");
    const out = finish(item, "I want to go to the market tomorrow morning with my mother", 42);
    expect(out.split("\n")).toHaveLength(2);
    expect(out.split("\n").every((l) => l.length <= 42)).toBe(true);
  });

  it("keeps short lines on one line", () => {
    expect(finish(prepare("a", "x"), "  Good\nmorning. ", 42)).toBe("Good morning.");
  });

  it("restores italics and tidies tags", () => {
    expect(finish(prepare("a", "<i>Ó ti lọ.</i>"), "He has gone.", 42)).toBe("<i>He has gone.</i>");
    expect(finish(prepare("a", "x"), "< i>Where</ I> are you?", 42)).toBe("<i>Where</i> are you?");
  });

  it("keeps one line per speaker in dialog", () => {
    expect(finish(prepare("a", "- A\n- B"), "- How are you? \n - I'm fine.", 42)).toBe("- How are you?\n- I'm fine.");
  });
});

describe("helpers", () => {
  it("isTranslated / hasWords", () => {
    expect(isTranslated({ text: "Hello", original: "Báwo" })).toBe(true);
    expect(isTranslated({ text: "Báwo", original: "Báwo" })).toBe(false);
    expect(isTranslated({ text: "", original: "Báwo" })).toBe(false);
    expect(hasWords("<i>♪</i>")).toBe(false);
    expect(hasWords("Ẹ")).toBe(true);
  });

  it("chunks by count and characters", () => {
    const items = ["aaaa", "bbbb", "cc", "dddddddddd", "e"].map((send) => ({ send }));
    expect(chunk(items, { items: 2, chars: 100 }).map((c) => c.length)).toEqual([2, 2, 1]);
    expect(chunk(items, { items: 10, chars: 8 }).map((c) => c.map((i) => i.send))).toEqual([
      ["aaaa", "bbbb"],
      ["cc"],
      ["dddddddddd"],
      ["e"],
    ]);
  });
});
