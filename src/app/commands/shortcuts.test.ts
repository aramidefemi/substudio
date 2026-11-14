import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCommands, defineCommands } from "./registry";
import { bindShortcuts } from "./shortcuts";

/** Minimal DOM stand-ins: the scope check uses `instanceof` on these. */
class FakeElement {
  closest() {
    return null;
  }
}
for (const name of ["Element", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "HTMLButtonElement"]) {
  vi.stubGlobal(name, class extends FakeElement {});
}

function key(type: "keydown" | "keyup", code: string, opts: { repeat?: boolean } = {}) {
  const e = new Event(type, { cancelable: true }) as Event & Record<string, unknown>;
  Object.assign(e, {
    key: code.replace(/^Key/, "").toLowerCase(),
    code,
    repeat: opts.repeat ?? false,
    isComposing: false,
    getModifierState: () => false,
  });
  return e;
}

describe("bindShortcuts", () => {
  let target: EventTarget;
  let unbind: () => void;
  const run = vi.fn();
  const release = vi.fn();
  const plain = vi.fn();

  beforeEach(() => {
    run.mockClear();
    release.mockClear();
    plain.mockClear();
    clearCommands();
    defineCommands([
      { id: "test.hold", label: "Hold", group: "Test", keys: ["KeyH"], scope: "outsideText", run, release },
      { id: "test.plain", label: "Plain", group: "Test", keys: ["KeyP"], scope: "outsideText", run: plain },
    ]);
    target = new EventTarget();
    unbind = bindShortcuts(target as unknown as Window);
  });
  afterEach(() => {
    unbind();
    clearCommands();
  });

  it("runs on keydown and releases on keyup, ignoring key repeat", () => {
    target.dispatchEvent(key("keydown", "KeyH"));
    target.dispatchEvent(key("keydown", "KeyH", { repeat: true }));
    target.dispatchEvent(key("keydown", "KeyH", { repeat: true }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
    target.dispatchEvent(key("keyup", "KeyH"));
    expect(release).toHaveBeenCalledTimes(1);
    target.dispatchEvent(key("keyup", "KeyH"));
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("releases a held key when the window loses focus", () => {
    target.dispatchEvent(key("keydown", "KeyH"));
    target.dispatchEvent(new Event("blur"));
    expect(release).toHaveBeenCalledTimes(1);
    target.dispatchEvent(key("keyup", "KeyH"));
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("keeps key repeat for commands without a release handler", () => {
    target.dispatchEvent(key("keydown", "KeyP"));
    target.dispatchEvent(key("keydown", "KeyP", { repeat: true }));
    expect(plain).toHaveBeenCalledTimes(2);
  });

  it("stops listening after unbind", () => {
    unbind();
    target.dispatchEvent(key("keydown", "KeyH"));
    target.dispatchEvent(key("keyup", "KeyH"));
    expect(run).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    unbind = () => undefined;
  });
});
