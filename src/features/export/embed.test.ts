import { describe, expect, it } from "vitest";
import { codecLabel, embeddedName, embedExtension, withEmbedExt } from "./embed";

describe("embed helpers", () => {
  it("keeps containers that hold subtitles, else MP4", () => {
    expect(embedExtension("/f/a.MKV")).toBe("mkv");
    expect(embedExtension("/f/a.mov")).toBe("mov");
    expect(embedExtension("/f/a.avi")).toBe("mp4");
    expect(embedExtension("/f/noext")).toBe("mp4");
  });

  it("names the output after the video, never the source", () => {
    expect(embeddedName("/films/Ayinla.mkv")).toBe("Ayinla.subs.mkv");
    expect(embeddedName("/films/a.b.avi")).toBe("a.b.subs.mp4");
  });

  it("adds an extension only when the dialog result lacks a supported one", () => {
    expect(withEmbedExt("/o/film", "/f/a.mkv")).toBe("/o/film.mkv");
    expect(withEmbedExt("/o/film.MOV", "/f/a.mkv")).toBe("/o/film.MOV");
    expect(withEmbedExt("/o/film.avi", "/f/a.mp4")).toBe("/o/film.avi.mp4");
  });

  it("labels codecs", () => {
    expect(codecLabel("mov_text")).toBe("mov_text track");
    expect(codecLabel("x")).toBe("x");
  });
});
