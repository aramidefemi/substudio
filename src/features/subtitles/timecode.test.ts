import { describe, expect, it } from "vitest";
import { formatDuration, formatTime, parseDuration, parseTime, type TimeFormat } from "./timecode";

const frames: TimeFormat = { mode: "frames", fps: 25 };
const ms: TimeFormat = { mode: "ms", fps: 25 };

describe("formatTime", () => {
  it("shows frames like her Subtitle Edit setup", () => {
    expect(formatTime(37.88, frames)).toBe("00:00:37:22");
    expect(formatTime(3661.04, frames)).toBe("01:01:01:01");
  });

  it("rolls a rounded-up last frame into the next second", () => {
    expect(formatTime(1.999, frames)).toBe("00:00:02:00");
  });

  it("shows milliseconds", () => {
    expect(formatTime(0.32, ms)).toBe("00:00:00,320");
  });
});

describe("formatDuration", () => {
  it("uses s:ff and s,mmm", () => {
    expect(formatDuration(1.84, frames)).toBe("1:21");
    expect(formatDuration(1.44, ms)).toBe("1,440");
  });
});

describe("parseTime", () => {
  it("parses both formats", () => {
    expect(parseTime("00:00:37:22", frames)).toBeCloseTo(37.88);
    expect(parseTime("00:00:00,320", frames)).toBeCloseTo(0.32);
    expect(parseTime("00:00:01.5", ms)).toBeCloseTo(1.5);
  });

  it("rejects bad input and out-of-range frames", () => {
    expect(parseTime("12:00", frames)).toBeNull();
    expect(parseTime("00:00:01:25", frames)).toBeNull();
  });

  it("round-trips frame-aligned times through formatTime", () => {
    for (const t of [0, 0.04, 12.52, 59.96, 4865.48]) {
      expect(parseTime(formatTime(t, frames), frames)).toBeCloseTo(t, 2);
    }
  });
});

describe("frame snapping", () => {
  it("rounds times between frames to the nearest frame", () => {
    expect(formatTime(12.5, frames)).toBe("00:00:12:13");
  });
});

describe("parseDuration", () => {
  it("parses s:ff and decimal seconds", () => {
    expect(parseDuration("2:00", frames)).toBe(2);
    expect(parseDuration("1,440", ms)).toBeCloseTo(1.44);
    expect(parseDuration("abc", ms)).toBeNull();
  });
});
