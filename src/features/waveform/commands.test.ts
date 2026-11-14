import { describe, expect, it } from "vitest";
import { formatShortcut } from "@/app/commands/keys";
import { WAVEFORM_COMMANDS } from "./commands";

describe("waveform commands", () => {
  it("keep every key out of text editing", () => {
    for (const c of WAVEFORM_COMMANDS) if (c.keys?.length) expect(c.scope, c.id).toBe("outsideText");
  });

  it("show bracket shortcuts readably", () => {
    expect(formatShortcut("Alt+BracketLeft", true)).toBe("⌥[");
    expect(formatShortcut("Alt+Shift+BracketRight", false)).toBe("Alt+Shift+]");
  });
});
