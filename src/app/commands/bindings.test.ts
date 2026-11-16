import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  applyKeyBindings,
  compactOverrides,
  overrideCommandKeys,
  sePresetOverrides,
} from "./bindings";
import { COMMANDS, registerCommands } from "./definitions";
import { allCommands, getCommand, getDefaultKeys } from "./registry";
import { SE_PRESET } from "./sePreset";

beforeAll(() => registerCommands());

beforeEach(() => applyKeyBindings({}));

describe("shortcut bindings", () => {
  it("restores Substudio defaults when overrides are empty", () => {
    applyKeyBindings({ "file.save": ["F1"] });
    expect(getCommand("file.save")?.keys).toEqual(["F1"]);
    applyKeyBindings({});
    expect(getCommand("file.save")?.keys).toEqual(getDefaultKeys("file.save"));
  });

  it("unbinds a command with an empty override", () => {
    applyKeyBindings({ "file.save": [] });
    expect(getCommand("file.save")?.keys).toBeUndefined();
  });

  it("SE preset maps the F9–F12 timing family and stays unique", () => {
    const overrides = sePresetOverrides();
    applyKeyBindings(overrides);
    expect(getCommand("timing.setStartOffsetRest")?.keys).toEqual(["F9"]);
    expect(getCommand("timing.setEndGoNext")?.keys).toEqual(["F10"]);
    expect(getCommand("timing.setStart")?.keys).toEqual(["F11"]);
    expect(getCommand("timing.setEnd")?.keys).toEqual(["F12"]);
    expect(getCommand("playback.playNext")?.keys).toEqual(["F8"]);

    const seen = new Map<string, string>();
    for (const c of allCommands()) {
      for (const k of c.keys ?? []) {
        expect(seen.get(k), `${k} on ${c.id} and ${seen.get(k)}`).toBeUndefined();
        seen.set(k, c.id);
      }
    }
  });

  it("SE preset only references real commands", () => {
    const ids = new Set(COMMANDS.map((c) => c.id));
    for (const id of Object.keys(SE_PRESET)) expect(ids.has(id), id).toBe(true);
  });

  it("overrideCommandKeys clears the same binding elsewhere", () => {
    const next = overrideCommandKeys({}, "view.privacy", ["$mod+KeyS"]);
    applyKeyBindings(next);
    expect(getCommand("view.privacy")?.keys).toEqual(["$mod+KeyS"]);
    expect(getCommand("file.save")?.keys).toBeUndefined();
  });

  it("compactOverrides drops entries that match defaults", () => {
    expect(compactOverrides({ "file.save": ["$mod+KeyS"] })).toEqual({});
  });
});
