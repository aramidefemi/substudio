import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadDocument, select, selectRangeTo, useSubtitles } from "@/features/subtitles/store";
import { clock } from "./clock";
import { nextSpeed, playBeforeSelection, playNeighbour, playSelection, PRE_ROLL, stepFrame, toggleLoopSelection } from "./transport";

describe("nextSpeed", () => {
  it("steps through the offered speeds and stops at the ends", () => {
    expect(nextSpeed(1, 1)).toBe(1.25);
    expect(nextSpeed(1, -1)).toBe(0.75);
    expect(nextSpeed(2, 1)).toBe(2);
    expect(nextSpeed(0.5, -1)).toBe(0.5);
  });

  it("snaps an off-list rate to the neighbouring speed", () => {
    expect(nextSpeed(1.1, 1)).toBe(1.25);
    expect(nextSpeed(1.1, -1)).toBe(1);
  });
});

describe("transport actions", () => {
  const ids = () => useSubtitles.getState().cues.map((c) => c.id);
  const selected = () => useSubtitles.getState().selectedId;

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    loadDocument(
      [
        { start: 1, end: 2, text: "a" },
        { start: 3, end: 4.5, text: "b" },
        { start: 6, end: 7, text: "c" },
      ],
      null,
    );
    clock.pause();
    clock.seek(0);
  });
  afterEach(() => {
    clock.pause();
    vi.unstubAllGlobals();
  });

  it("plays the selected line, or the span of a multi-selection", () => {
    select(ids()[1]!);
    playSelection();
    expect(clock.range).toEqual({ start: 3, end: 4.5, loop: false });
    expect(clock.time).toBe(3);
    selectRangeTo(ids()[2]!);
    playSelection();
    expect(clock.range).toEqual({ start: 3, end: 7, loop: false });
  });

  it("toggles a loop on the selected line", () => {
    select(ids()[0]!);
    toggleLoopSelection();
    expect(clock.looping).toBe(true);
    toggleLoopSelection();
    expect(clock.looping).toBe(false);
    expect(clock.playing).toBe(false);
  });

  it("plays on from just before the line, without a range", () => {
    select(ids()[1]!);
    playBeforeSelection();
    expect(clock.time).toBeCloseTo(3 - PRE_ROLL);
    expect(clock.range).toBeNull();
    expect(clock.playing).toBe(true);
  });

  it("selects and plays the next / previous line", () => {
    select(ids()[0]!);
    expect(playNeighbour(1)).toBe(true);
    expect(selected()).toBe(ids()[1]);
    expect(clock.range).toEqual({ start: 3, end: 4.5, loop: false });
    expect(playNeighbour(-1, true)).toBe(true);
    expect(selected()).toBe(ids()[0]);
    expect(clock.range).toEqual({ start: 1, end: 2, loop: true });
    expect(playNeighbour(-1)).toBe(false);
    expect(selected()).toBe(ids()[0]);
  });

  it("starts at the first line when nothing is selected", () => {
    select(null);
    expect(playNeighbour(-1)).toBe(false);
    expect(playNeighbour(1)).toBe(true);
    expect(selected()).toBe(ids()[0]);
  });

  it("steps a frame at the project fps and pauses", () => {
    clock.seek(1);
    clock.play();
    stepFrame(1);
    expect(clock.playing).toBe(false);
    expect(clock.time).toBeCloseTo(1 + 1 / useSubtitles.getState().fps);
  });
});
