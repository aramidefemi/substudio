import { clock } from "@/features/playback/clock";
import { isMac } from "@/app/commands/keys";
import {
  select,
  selectSelectedCue,
  selectSelectedIndex,
  setCueTimes,
  useSubtitles,
  type TimeChange,
} from "@/features/subtitles/store";
import { cursorFor, dragCue, hitTest, setEdgeAt, type DragMode, type Span } from "./drag";
import { useWaveView } from "./view";

/** Pointer travel (px) before a press on a cue becomes a drag. */
const DRAG_THRESHOLD_PX = 2;

interface CueGesture {
  pointerId: number;
  mode: DragMode;
  id: string;
  origin: Span;
  prevId?: string;
  prev?: Span;
  nextId?: string;
  next?: Span;
  /** Pointer x (px) at press. */
  x0: number;
  /** Undo merge key: the whole gesture is one undo step. */
  key: string;
  moved: boolean;
}

let gestureSeq = 0;

const span = (c: Span | undefined): Span | undefined => (c ? { start: c.start, end: c.end } : undefined);

/**
 * Waveform mouse handling, outside React: hover cursors, click to seek, and
 * dragging cue edges / middles. Pointer moves are coalesced to one document
 * edit per animation frame. Returns a cleanup function.
 */
export function attachPointer(canvas: HTMLCanvasElement): () => void {
  let g: CueGesture | null = null;
  let pending: PointerEvent | null = null;
  let frame = 0;

  const localX = (e: PointerEvent) => e.clientX - canvas.getBoundingClientRect().left;
  const timeAt = (x: number) => {
    const { start, pps } = useWaveView.getState();
    return start + x / pps;
  };
  const hitAt = (x: number) => {
    const s = useSubtitles.getState();
    const { start, pps } = useWaveView.getState();
    return hitTest(s.cues, x, start, pps, selectSelectedIndex(s));
  };

  const apply = () => {
    frame = 0;
    const e = pending;
    if (!g || !e) return;
    const x = localX(e);
    if (!g.moved && Math.abs(x - g.x0) < DRAG_THRESHOLD_PX) return;
    g.moved = true;
    const r = dragCue({
      mode: g.mode,
      origin: g.origin,
      prev: g.prev,
      next: g.next,
      dt: (x - g.x0) / useWaveView.getState().pps,
      linked: e.altKey,
    });
    const changes: TimeChange[] = [{ id: g.id, start: r.start, end: r.end }];
    if (g.prevId && r.prevEnd !== undefined) changes.push({ id: g.prevId, end: r.prevEnd });
    if (g.nextId && r.nextStart !== undefined) changes.push({ id: g.nextId, start: r.nextStart });
    setCueTimes(changes, g.key);
  };

  /** Shift+click sets the selected cue's start, ⌘/Ctrl+click its end. True when handled. */
  const modifierClick = (e: PointerEvent, x: number) => {
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (e.shiftKey === mod) return false; // neither, or both
    const cue = selectSelectedCue(useSubtitles.getState());
    if (!cue) return true;
    const t = setEdgeAt(cue, e.shiftKey ? "start" : "end", timeAt(x));
    setCueTimes([{ id: cue.id, ...t }]);
    return true;
  };

  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const x = localX(e);
    if (modifierClick(e, x)) return;
    const hit = hitAt(x);
    if (!hit) {
      clock.seek(timeAt(x));
      return;
    }
    const { cues } = useSubtitles.getState();
    const cue = cues[hit.index]!;
    const prev = cues[hit.index - 1];
    const next = cues[hit.index + 1];
    select(cue.id);
    if (hit.mode === "move") clock.seek(timeAt(x));
    g = {
      pointerId: e.pointerId,
      mode: hit.mode,
      id: cue.id,
      origin: span(cue)!,
      prevId: prev?.id,
      prev: span(prev),
      nextId: next?.id,
      next: span(next),
      x0: x,
      key: `waveform-drag:${++gestureSeq}`,
      moved: false,
    };
    pending = null;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = cursorFor(hit, true);
  };

  const move = (e: PointerEvent) => {
    if (!g) {
      canvas.style.cursor = cursorFor(hitAt(localX(e)));
      return;
    }
    if (e.pointerId !== g.pointerId) return;
    pending = e;
    if (!frame) frame = requestAnimationFrame(apply);
  };

  const finish = (e: PointerEvent, cancelled: boolean) => {
    if (!g || e.pointerId !== g.pointerId) return;
    if (frame) {
      cancelAnimationFrame(frame);
      apply(); // flush the last position
    }
    // A click (no drag) on an edge still seeks, like a click anywhere else.
    if (!cancelled && !g.moved && g.mode !== "move") clock.seek(timeAt(localX(e)));
    g = null;
    pending = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    canvas.style.cursor = cursorFor(hitAt(localX(e)));
  };
  const up = (e: PointerEvent) => finish(e, false);
  const cancel = (e: PointerEvent) => finish(e, true);

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", cancel);
  return () => {
    cancelAnimationFrame(frame);
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", up);
    canvas.removeEventListener("pointercancel", cancel);
  };
}
