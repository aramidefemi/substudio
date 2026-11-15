/** File types the app opens, by extension (lowercase, no dot). */
export const SUBTITLE_EXTENSIONS = ["srt", "vtt", "ass", "ssa", "sbv", "ttml", "dfxp"];
export const VIDEO_EXTENSIONS = ["mp4", "mov", "m4v", "webm"];

export const extensionOf = (path: string) => {
  const name = path.split(/[\\/]/).pop() ?? path;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};

export interface DropPlan {
  /** First subtitle file among the dropped paths. */
  subtitle: string | null;
  /** First video file among the dropped paths. */
  video: string | null;
  /** Paths we can't open (folders, other formats, extra files of a kind we already picked). */
  ignored: string[];
}

/** Decides what a drop of `paths` opens: at most one subtitle and one video. */
export function planDrop(paths: readonly string[]): DropPlan {
  const plan: DropPlan = { subtitle: null, video: null, ignored: [] };
  for (const path of paths) {
    const ext = extensionOf(path);
    if (SUBTITLE_EXTENSIONS.includes(ext) && !plan.subtitle) plan.subtitle = path;
    else if (VIDEO_EXTENSIONS.includes(ext) && !plan.video) plan.video = path;
    else plan.ignored.push(path);
  }
  return plan;
}

/** Short overlay text for a drag in progress. */
export function describeDrop(plan: DropPlan): string {
  if (plan.subtitle && plan.video) return "Drop to open the subtitles and the video";
  if (plan.subtitle) return "Drop to open the subtitles";
  if (plan.video) return "Drop to open the video";
  return "Only .srt, .vtt, .ass, .ssa, .sbv, .ttml, .dfxp and .mp4, .mov, .m4v, .webm files can be opened";
}
