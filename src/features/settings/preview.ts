/** How the subtitle is drawn over the video (app-wide, like Subtitle Edit's preview properties). */
export type PreviewBackground = "box" | "outline";
export type PreviewSize = "small" | "medium" | "large" | "xlarge";
export type PreviewPosition = "low" | "standard" | "raised" | "top";

export interface PreviewStyle {
  background: PreviewBackground;
  size: PreviewSize;
  position: PreviewPosition;
}

export const DEFAULT_PREVIEW: PreviewStyle = { background: "box", size: "medium", position: "standard" };

export const PREVIEW_SIZES: { id: PreviewSize; label: string; /** % of the video height */ scale: number }[] = [
  { id: "small", label: "Small", scale: 4.2 },
  { id: "medium", label: "Medium", scale: 5.4 },
  { id: "large", label: "Large", scale: 6.8 },
  { id: "xlarge", label: "Extra large", scale: 8.4 },
];

export const PREVIEW_POSITIONS: { id: PreviewPosition; label: string; /** % margin from the edge */ margin: number }[] = [
  { id: "low", label: "Low", margin: 3 },
  { id: "standard", label: "Standard", margin: 8 },
  { id: "raised", label: "Raised", margin: 18 },
  { id: "top", label: "Top", margin: 6 },
];

export const PREVIEW_BACKGROUNDS: { id: PreviewBackground; label: string }[] = [
  { id: "box", label: "Background box" },
  { id: "outline", label: "Outline" },
];

const ids = <T extends { id: string }>(list: T[]) => list.map((x) => x.id);

/** Fills unknown or missing fields (old or hand-edited settings files) with defaults. */
export function normalizePreview(value: unknown): PreviewStyle {
  const v = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof PreviewStyle, unknown>>;
  const pick = <T extends string>(x: unknown, allowed: string[], fallback: T): T =>
    typeof x === "string" && allowed.includes(x) ? (x as T) : fallback;
  return {
    background: pick(v.background, ids(PREVIEW_BACKGROUNDS), DEFAULT_PREVIEW.background),
    size: pick(v.size, ids(PREVIEW_SIZES), DEFAULT_PREVIEW.size),
    position: pick(v.position, ids(PREVIEW_POSITIONS), DEFAULT_PREVIEW.position),
  };
}

/** The neighbouring option (clamped), for the bigger/smaller and higher/lower commands. */
export function stepOption<T extends string>(list: { id: T }[], current: T, delta: number): T {
  const i = list.findIndex((x) => x.id === current);
  const next = Math.max(0, Math.min(list.length - 1, (i < 0 ? 0 : i) + delta));
  return list[next]!.id;
}

/** Layout for the overlay: font size as a share of the video height, and where it sits. */
export function previewLayout(style: PreviewStyle) {
  const size = PREVIEW_SIZES.find((s) => s.id === style.size) ?? PREVIEW_SIZES[1]!;
  const pos = PREVIEW_POSITIONS.find((p) => p.id === style.position) ?? PREVIEW_POSITIONS[1]!;
  return {
    /** Font size in `cqh` (container query height units) with a readable floor. */
    fontSize: `max(12px, ${size.scale}cqh)`,
    anchor: style.position === "top" ? ("top" as const) : ("bottom" as const),
    margin: `${pos.margin}%`,
    box: style.background === "box",
  };
}
