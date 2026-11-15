import { describe, expect, it } from "vitest";
import { burnedName, percent, withMp4 } from "./burn";

describe("burn-in helpers", () => {
  it("names the output after the video, never the source", () => {
    expect(burnedName("/films/Ayinla.mkv")).toBe("Ayinla.burned.mp4");
    expect(burnedName("/films/a.b.mp4")).toBe("a.b.burned.mp4");
  });

  it("forces an .mp4 extension", () => {
    expect(withMp4("/o/film")).toBe("/o/film.mp4");
    expect(withMp4("/o/film.MP4")).toBe("/o/film.MP4");
    expect(withMp4("/o/film.mov")).toBe("/o/film.mov.mp4");
  });

  it("formats progress", () => {
    expect(percent(0.426)).toBe("43%");
  });
});
