import { beforeEach, describe, expect, it } from "vitest";
import {
  acceptMachineTranslations,
  applyMachineTranslations,
  loadDocument,
  seedOriginalsFromText,
  undo,
  updateCue,
  useSubtitles,
} from "@/features/subtitles/store";

const cues = () => useSubtitles.getState().cues;

beforeEach(() => {
  loadDocument(
    [
      { start: 0, end: 1, text: "Ẹ kú àárọ̀" },
      { start: 2, end: 3, text: "Níbo lò ń lọ?" },
    ],
    null,
  );
});

describe("machine translation in the document (TRN-01)", () => {
  it("seeds originals, writes drafts, and undoes the whole pass in one step", () => {
    const [a, b] = cues();
    seedOriginalsFromText("translate:1");
    applyMachineTranslations(new Map([[a!.id, "Good morning"]]), "translate:1");
    applyMachineTranslations(new Map([[b!.id, "Where are you going?"]]), "translate:1");
    expect(cues().map((c) => [c.original, c.text, c.mt])).toEqual([
      ["Ẹ kú àárọ̀", "Good morning", true],
      ["Níbo lò ń lọ?", "Where are you going?", true],
    ]);
    undo();
    expect(cues().map((c) => [c.original, c.text, c.mt])).toEqual([
      [undefined, "Ẹ kú àárọ̀", undefined],
      [undefined, "Níbo lò ń lọ?", undefined],
    ]);
  });

  it("typing in a draft clears the mark; accepting clears it and keeps the text", () => {
    const [a, b] = cues();
    applyMachineTranslations(new Map([[a!.id, "Good morning"], [b!.id, "Where to?"]]));
    updateCue(a!.id, { text: "Good morning, ma" });
    acceptMachineTranslations([b!.id]);
    expect(cues().map((c) => [c.text, c.mt])).toEqual([
      ["Good morning, ma", undefined],
      ["Where to?", undefined],
    ]);
  });

  it("changing only times keeps the mark", () => {
    const [a] = cues();
    applyMachineTranslations(new Map([[a!.id, "Good morning"]]));
    updateCue(a!.id, { end: 1.5 });
    expect(cues()[0]!.mt).toBe(true);
  });
});
