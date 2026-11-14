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
import { cursorFor, dragCue, hitTest, MIN_CUE_LEN, setEdgeAt, type DragMode, type Span } from "./drag";
import { clearRegion, gapAround, regionContains, regionFromDrag, setRegion, useRegion } from "./region";
import { useWaveView } from "./view";

/** Pointer travel (px) before a press becomes a drag. */
const DRAG_THRESHOLD_PX = 2;

interface CueGesture {
  kind: "cue";
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

/** Press on empty space: a click seeks, a drag marks a region inside the gap. */
interface RegionGesture {
  kind: "region";
  pointerId: number;
  x0: number;
  anchor: number;
  gap: { lo: number; hi: number };
  /** Pressed inside the existing region (so a plain click keeps it for double-click). */
  inRegion: boolean;
  moved: boolean;
}

type Gesture = CueGesture | RegionGesture;

let gestureSeq = 0;

const span = (c: Span | undefined): Span | undefined => (c ? { start: c.start, end: c.end } : undefined);

/**
 * Waveform mouse handling, outside React: hover cursors, click to seek,
 * dragging cue edges / middles, marking regions and modifier clicks. Pointer
 * moves are coalesced to one update per animation frame. Returns a cleanup.
 */
export function attachPointer(canvas: HTMLCanvasElement): () => void {
  let g: Gesture | null = null;
  let pending: PointerEvent | null = null;
  let frame = 0;

  const localX = (e: PointerEvent) => e.clientX - canvas.getBoundingClientRect().left;
  const timeAt = (x: number) => {
    const { start, pps } = useWaveView.getState();
    return Math.max(0, start + x / pps);
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
    if (g.kind === "region") {
      setRegion(regionFromDrag(g.anchor, timeAt(x), g.gap));
      return;
    }
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
    // macOS Ctrl+click is a right-click: leave it to the context menu.
    if (e.button !== 0 || (isMac && e.ctrlKey)) return;
    const x = localX(e);
    if (modifierClick(e, x)) return;
    const hit = hitAt(x);
    const t = timeAt(x);
    if (!hit) {
      clock.seek(t);
      const gap = gapAround(useSubtitles.getState().cues, t);
      if (!gap) return;
      g = {
        kind: "region",
        pointerId: e.pointerId,
        x0: x,
        anchor: t,
        gap,
        inRegion: regionContains(useRegion.getState().region, t),
        moved: false,
      };
    } else {
      clearRegion();
      const { cues } = useSubtitles.getState();
      const cue = cues[hit.index]!;
      const prev = cues[hit.index - 1];
      const next = cues[hit.index + 1];
      select(cue.id);
      if (hit.mode === "move") clock.seek(t);
      g = {
        kind: "cue",
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
      canvas.style.cursor = cursorFor(hit, true);
    }
    pending = null;
    canvas.setPointerCapture(e.pointerId);
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
    if (g.kind === "region") {
      const r = useRegion.getState().region;
      if (!g.moved && !g.inRegion) clearRegion(); // a plain click elsewhere drops the region
      else if (g.moved && r && r.end - r.start < MIN_CUE_LEN) clearRegion(); // too short to be a cue
    } else if (!cancelled && !g.moved && g.mode !== "move") {
      // A click (no drag) on an edge still seeks, like a click anywhere else.
      clock.seek(timeAt(localX(e)));
    }
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
