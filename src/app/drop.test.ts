import { describe, expect, it } from "vitest";
import { describeDrop, extensionOf, planDrop } from "./drop";

describe("extensionOf", () => {
  it("lowercases and ignores folders and dotfiles", () => {
    expect(extensionOf("/Films/Ìyá Mi.SRT")).toBe("srt");
    expect(extensionOf("C:\\films\\cut.v2.mov")).toBe("mov");
    expect(extensionOf("/Films/folder")).toBe("");
    expect(extensionOf("/Users/me/.hidden")).toBe("");
  });
});

describe("planDrop", () => {
  it("routes a subtitle and a video", () => {
    const plan = planDrop(["/a/film.mp4", "/a/film.srt"]);
    expect(plan).toEqual({ subtitle: "/a/film.srt", video: "/a/film.mp4", ignored: [] });
    expect(describeDrop(plan)).toMatch(/subtitles and the video/);
  });

  it("keeps only the first of each kind and ignores unknown files", () => {
    const plan = planDrop(["/a/1.vtt", "/a/2.srt", "/a/notes.docx", "/a/clip.webm"]);
    expect(plan.subtitle).toBe("/a/1.vtt");
    expect(plan.video).toBe("/a/clip.webm");
    expect(plan.ignored).toEqual(["/a/2.srt", "/a/notes.docx"]);
  });

  it("explains when nothing can be opened", () => {
    const plan = planDrop(["/a/film.mkv"]);
    expect(plan.subtitle).toBeNull();
    expect(plan.video).toBeNull();
    expect(describeDrop(plan)).toMatch(/Only/);
  });
});
