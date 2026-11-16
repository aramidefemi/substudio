import { describe, expect, it } from "vitest";
import { formatShortcut } from "@/app/commands/keys";
import { WAVEFORM_COMMANDS } from "./commands";

describe("waveform commands", () => {
  it("keep text-colliding keys out of text editing", () => {
    for (const c of WAVEFORM_COMMANDS) {
      if (!c.keys?.length) continue;
      // $mod shortcuts are safe while typing; Alt+brackets etc. are not.
      if (c.keys.every((k) => k.includes("$mod"))) continue;
      expect(c.scope, c.id).toBe("outsideText");
    }
  });

  it("registers a spectrogram toggle", () => {
    expect(WAVEFORM_COMMANDS.some((c) => c.id === "waveform.toggleSpectrogram")).toBe(true);
  });

  it("show bracket shortcuts readably", () => {
    expect(formatShortcut("Alt+BracketLeft", true)).toBe("⌥[");
    expect(formatShortcut("Alt+Shift+BracketRight", false)).toBe("Alt+Shift+]");
  });
});
