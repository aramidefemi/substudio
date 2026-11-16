import { describe, expect, it } from "vitest";
import { bindingFromEvent, formatShortcut, toAccelerator } from "./keys";

describe("toAccelerator", () => {
  it("converts tinykeys bindings to Tauri accelerators", () => {
    expect(toAccelerator("$mod+KeyS")).toBe("CmdOrCtrl+S");
    expect(toAccelerator("$mod+Shift+KeyO")).toBe("CmdOrCtrl+Shift+O");
    expect(toAccelerator("Alt+Shift+KeyE")).toBe("Alt+Shift+E");
    expect(toAccelerator("$mod+Alt+Enter")).toBe("CmdOrCtrl+Alt+Return");
    expect(toAccelerator("Shift+F10")).toBe("Shift+F10");
    expect(toAccelerator("$mod+Shift+ArrowLeft")).toBe("CmdOrCtrl+Shift+Left");
  });
});

describe("bindingFromEvent", () => {
  it("builds tinykeys bindings with $mod for Ctrl/Meta", () => {
    const event = {
      key: "s",
      code: "KeyS",
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: true,
    } as KeyboardEvent;
    expect(bindingFromEvent(event)).toBe("$mod+Shift+KeyS");
    expect(bindingFromEvent({ ...event, key: "Meta", code: "MetaLeft" } as KeyboardEvent)).toBeNull();
  });
});

describe("formatShortcut", () => {
  it("uses macOS symbols in the standard order", () => {
    expect(formatShortcut("$mod+Shift+KeyS", true)).toBe("⇧⌘S");
    expect(formatShortcut("Alt+ArrowLeft", true)).toBe("⌥←");
    expect(formatShortcut("$mod+Alt+Enter", true)).toBe("⌥⌘↩");
    expect(formatShortcut("F10", true)).toBe("F10");
  });

  it("spells modifiers out elsewhere", () => {
    expect(formatShortcut("$mod+Shift+KeyS", false)).toBe("Ctrl+Shift+S");
    expect(formatShortcut("Space", false)).toBe("Space");
  });
});
