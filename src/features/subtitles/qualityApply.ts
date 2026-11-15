import type { Cue, CueData } from "./types";
import { edit, useSubtitles } from "./store";

let seq = 0;
const newId = () => `q${Date.now().toString(36)}_${++seq}`;

/**
 * Replace document cue bodies with `next`, preserving ids/bookmarks for the
 * overlapping prefix. Undoes as one step.
 */
export function applyCueData(next: readonly CueData[], key = "quality") {
  edit((doc) => {
    const old = doc.cues;
    if (next.length === old.length) {
      for (let i = 0; i < next.length; i++) {
        const c = old[i]!;
        const n = next[i]!;
        c.start = n.start;
        c.end = n.end;
        c.text = n.text;
      }
      return;
    }
    const rebuilt: Cue[] = next.map((n, i) => {
      const prev = old[i];
      if (prev) {
        return {
          id: prev.id,
          start: n.start,
          end: n.end,
          text: n.text,
          ...(prev.bookmark !== undefined ? { bookmark: prev.bookmark } : {}),
          ...(prev.untimed ? { untimed: true } : {}),
        };
      }
      return { id: newId(), start: n.start, end: n.end, text: n.text };
    });
    doc.cues = rebuilt;
  }, key);

  // Drop selection entries that no longer exist.
  const s = useSubtitles.getState();
  const alive = new Set(s.cues.map((c) => c.id));
  const selectedIds = s.selectedIds.filter((id) => alive.has(id));
  const selectedId =
    s.selectedId && alive.has(s.selectedId) ? s.selectedId : (selectedIds[0] ?? s.cues[0]?.id ?? null);
  if (selectedId && !selectedIds.includes(selectedId)) selectedIds.push(selectedId);
  useSubtitles.setState({
    selectedId,
    selectedIds,
    selectionAnchor:
      s.selectionAnchor && alive.has(s.selectionAnchor) ? s.selectionAnchor : selectedId,
  });
}
