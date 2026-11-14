import { describe, expect, it } from "vitest";
import { DEFAULT_PREVIEW, normalizePreview, PREVIEW_SIZES, previewLayout, stepOption } from "./preview";

describe("normalizePreview", () => {
  it("defaults missing or bad values", () => {
    expect(normalizePreview(undefined)).toEqual(DEFAULT_PREVIEW);
    expect(normalizePreview({ background: "outline", size: "huge", position: 3 })).toEqual({
      ...DEFAULT_PREVIEW,
      background: "outline",
    });
  });
});

describe("stepOption", () => {
  it("steps and clamps at both ends", () => {
    expect(stepOption(PREVIEW_SIZES, "medium", 1)).toBe("large");
    expect(stepOption(PREVIEW_SIZES, "xlarge", 1)).toBe("xlarge");
    expect(stepOption(PREVIEW_SIZES, "small", -1)).toBe("small");
  });
});

describe("previewLayout", () => {
  it("scales with the video height and anchors to the chosen edge", () => {
    const base = previewLayout(DEFAULT_PREVIEW);
    expect(base).toEqual({ fontSize: "max(12px, 5.4cqh)", anchor: "bottom", margin: "8%", box: true });
    const top = previewLayout({ background: "outline", size: "large", position: "top" });
    expect(top.anchor).toBe("top");
    expect(top.box).toBe(false);
  });
});
