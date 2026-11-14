import { beforeAll, describe, expect, it } from "vitest";
import { COMMANDS, registerCommands } from "./definitions";
import { buildMenuSpec, menuCommandIds, type MenuSpec } from "./menu";
import { allCommands, commandTitle, getCommand } from "./registry";

beforeAll(() => registerCommands());

const items = (spec: MenuSpec[]): Extract<MenuSpec, { type: "item" }>[] =>
  spec.flatMap((n) => (n.type === "item" ? [n] : n.type === "submenu" ? items(n.items) : []));

describe("command registry", () => {
  it("has unique ids", () => {
    const ids = COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never binds the same key to two commands", () => {
    const seen = new Map<string, string>();
    for (const c of allCommands()) {
      for (const k of c.keys ?? []) {
        expect(seen.get(k), `${k} on ${c.id} and ${seen.get(k)}`).toBeUndefined();
        seen.set(k, c.id);
      }
    }
  });

  it("only references real commands from the menu", () => {
    for (const id of menuCommandIds()) expect(getCommand(id), id).toBeDefined();
    expect(() => buildMenuSpec()).not.toThrow();
  });

  it("keeps typing-unsafe shortcuts out of native accelerators", () => {
    const accel = new Map(items(buildMenuSpec()).map((i) => [i.id, i.accelerator]));
    expect(accel.get("timing.moveStart.frame.-")).toBeNull(); // ⌥← is word-jump while typing
    expect(accel.get("edit.mergeNext")).toBeNull(); // ⌘⇧→ selects to line end while typing
    expect(accel.get("file.save")).toBe("CmdOrCtrl+S");
    expect(accel.get("timing.setEndGoNext")).toBe("F10");
    expect(accel.get("nav.focusList")).toBe("CmdOrCtrl+1"); // leaves the text box too
    expect(accel.get("playback.playSelection")).toBe("F5");
  });

  it("formats titles with shortcuts", () => {
    expect(commandTitle("file.save")).toMatch(/^Save \((⌘S|Ctrl\+S)\)$/);
    expect(commandTitle("file.compare")).toBe("Compare with file…");
  });
});
