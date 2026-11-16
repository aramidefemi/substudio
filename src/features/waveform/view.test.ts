import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_AMP,
  DEFAULT_PPS,
  MAX_AMP,
  MIN_AMP,
  centerOn,
  resetZoom,
  setAmplitude,
  setZoom,
  useWaveView,
} from "./view";

beforeEach(() => {
  useWaveView.setState({ start: 0, pps: DEFAULT_PPS, amp: DEFAULT_AMP, display: "waveform" });
});

describe("setAmplitude", () => {
  it("clamps to min/max", () => {
    setAmplitude(0.01);
    expect(useWaveView.getState().amp).toBe(MIN_AMP);
    setAmplitude(99);
    expect(useWaveView.getState().amp).toBe(MAX_AMP);
  });

  it("scales within range", () => {
    setAmplitude(2);
    expect(useWaveView.getState().amp).toBe(2);
  });
});

describe("centerOn", () => {
  it("places time at the given fraction of the viewport", () => {
    setZoom(100);
    centerOn(10, 200, 0.5);
    // 10s at centre of 200px @ 100 pps → start = 10 - 1 = 9
    expect(useWaveView.getState().start).toBe(9);
  });
});

describe("resetZoom", () => {
  it("restores default pps and amp", () => {
    setZoom(400);
    setAmplitude(3);
    useWaveView.setState({ start: 12 });
    resetZoom();
    expect(useWaveView.getState()).toMatchObject({ pps: DEFAULT_PPS, amp: DEFAULT_AMP, start: 12 });
  });

  it("can recentre on a time", () => {
    setZoom(400);
    setAmplitude(3);
    resetZoom({ centerTime: 20, widthPx: 240 });
    const { pps, amp, start } = useWaveView.getState();
    expect(pps).toBe(DEFAULT_PPS);
    expect(amp).toBe(DEFAULT_AMP);
    expect(start).toBe(20 - 240 / 2 / DEFAULT_PPS);
  });
});
