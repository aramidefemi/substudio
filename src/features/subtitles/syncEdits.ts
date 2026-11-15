import { edit, useSubtitles } from "./store";
import { countRemapped, remapCues, type SyncAnchor } from "./sync";
import type { Cue } from "./types";

/** Sync operations on the open document (SYN). Each one is a single undo step. */

const byStart = (a: Cue, b: Cue) => a.start - b.start;

/**
 * SYN-02: remap all cues through ≥2 anchors (piecewise linear). One undo step.
 * Returns how many cues changed, or 0 when anchors are invalid / nothing moves.
 */
export function applyPointSync(anchors: readonly SyncAnchor[]): number {
  const { cues } = useSubtitles.getState();
  const next = remapCues(cues, anchors);
  if (!next) return 0;
  const changed = countRemapped(cues, next);
  if (!changed) return 0;
  edit((doc) => {
    for (let i = 0; i < doc.cues.length; i++) {
      const mapped = next[i]!;
      const c = doc.cues[i]!;
      c.start = mapped.start;
      c.end = mapped.end;
      if (c.untimed && (mapped.start !== 0 || mapped.end !== 0)) delete c.untimed;
    }
    doc.cues.sort(byStart);
  });
  return changed;
}
