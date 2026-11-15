import { describe, expect, it } from "vitest";
import { normalizePresets, renderCustomText } from "./customText";
import { STARTER_PRESETS } from "./presets";

const time = { mode: "ms" as const, fps: 25 };
const cues = [
  { start: 1.5, end: 3, text: "Hello\nworld" },
  { start: 4, end: 5.25, text: 'Say "hi"', style: "Sign" },
];

describe("renderCustomText", () => {
  it("renders timed list starter", () => {
    const out = renderCustomText(cues, STARTER_PRESETS[0]!.template, time);
    expect(out).toContain("00:00:01,500 --> 00:00:03,000\nHello\nworld\n\n");
    expect(out).toContain("00:00:04,000 --> 00:00:05,250\nSay \"hi\"\n\n");
  });

  it("supports index, style, lineN, and duration", () => {
    const out = renderCustomText(
      cues,
      { header: "total={total}\n", body: "{number}|{style}|{line1}|{duration}\n", footer: "" },
      time,
    );
    expect(out).toBe("total=2\n1||Hello|1,500\n2|Sign|Say \"hi\"|1,250\n");
  });

  it("leaves unknown tokens intact", () => {
    expect(renderCustomText(cues, { header: "", body: "{nope}\n", footer: "" }, time)).toBe("{nope}\n{nope}\n");
  });

  it("uses frames when asked", () => {
    const out = renderCustomText(
      [{ start: 1, end: 2, text: "A" }],
      { header: "", body: "{start}\n", footer: "" },
      { mode: "frames", fps: 25 },
    );
    expect(out).toBe("00:00:01:00\n");
  });
});

describe("normalizePresets", () => {
  it("drops empty bodies and fills defaults", () => {
    expect(
      normalizePresets([
        { id: "a", name: "Ok", extension: ".csv", template: { header: "H", body: "{text}\n", footer: "" } },
        { name: "Bad", template: { header: "", body: "", footer: "" } },
      ]),
    ).toEqual([
      { id: "a", name: "Ok", extension: "csv", template: { header: "H", body: "{text}\n", footer: "" } },
    ]);
  });
});
