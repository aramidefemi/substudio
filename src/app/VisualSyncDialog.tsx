import { Crosshair, Play, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clock } from "@/features/playback/clock";
import {
  selectSelectedIndex,
  selectTimeFormat,
  select,
  useSubtitles,
} from "@/features/subtitles/store";
import {
  anchorAt,
  anchorsMonotonic,
  countRemapped,
  normalizeAnchors,
  remapCues,
  type SyncAnchor,
} from "@/features/subtitles/sync";
import { applyPointSync } from "@/features/subtitles/syncEdits";
import { formatTime } from "@/features/subtitles/timecode";
import { closeVisualSync as close, useSyncUi } from "./syncUi";

/** Upsert an anchor for `index` (last write wins). */
function upsert(anchors: SyncAnchor[], next: SyncAnchor): SyncAnchor[] {
  const i = anchors.findIndex((a) => a.index === next.index);
  if (i < 0) return [...anchors, next];
  const copy = anchors.slice();
  copy[i] = next;
  return copy;
}

function VisualSyncForm() {
  const fmt = useSubtitles(useShallow(selectTimeFormat));
  const cues = useSubtitles((s) => s.cues);
  const selectedIndex = useSubtitles(selectSelectedIndex);
  const [anchors, setAnchors] = useState<SyncAnchor[]>([]);
  const playheadRef = useRef<HTMLSpanElement>(null);

  // Playhead readout via DOM — no per-frame React state.
  useEffect(() => {
    const paint = () => {
      if (playheadRef.current) playheadRef.current.textContent = formatTime(clock.time, fmt);
    };
    paint();
    return clock.onTick(paint);
  }, [fmt, selectedIndex]);

  const pts = useMemo(() => normalizeAnchors(anchors), [anchors]);
  const mono = anchorsMonotonic(anchors);
  const preview = useMemo(() => (pts && mono ? remapCues(cues, pts) : null), [cues, pts, mono]);
  const changed = preview ? countRemapped(cues, preview) : 0;
  const canApply = !!preview && changed > 0;

  const addFromPlayhead = () => {
    if (selectedIndex < 0) {
      toast.message("Select a subtitle line first");
      return;
    }
    const a = anchorAt(cues, selectedIndex, clock.time);
    if (!a) return;
    setAnchors((prev) => upsert(prev, a));
  };

  const setVideoFromPlayhead = (index: number) => {
    const a = anchorAt(cues, index, clock.time);
    if (!a) return;
    setAnchors((prev) => upsert(prev, a));
  };

  const remove = (index: number) => setAnchors((prev) => prev.filter((a) => a.index !== index));

  const seekCue = (index: number) => {
    const cue = cues[index];
    if (!cue) return;
    select(cue.id);
    clock.seek(cue.start);
  };

  const seekVideo = (t: number) => clock.seek(t);

  const apply = () => {
    if (!pts || !canApply) return;
    const n = applyPointSync(pts);
    if (!n) return;
    toast.success(`Synced ${n} line${n === 1 ? "" : "s"}`);
    close();
  };

  const sorted = useMemo(
    () => [...anchors].sort((a, b) => a.subTime - b.subTime || a.index - b.index),
    [anchors],
  );

  // Preview rows: lines between first and last anchor, plus any that still move outside.
  const previewRows = useMemo(() => {
    if (!preview || !pts) return [];
    const lo = pts[0]!.index;
    const hi = pts[pts.length - 1]!.index;
    return cues
      .map((c, i) => ({ i, before: c, after: preview[i]! }))
      .filter(({ i, before, after }) => {
        const moved = before.start !== after.start || before.end !== after.end;
        return moved && i >= lo && i <= hi;
      });
  }, [cues, preview, pts]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Visual sync</DialogTitle>
        <DialogDescription>
          Pin two or more lines to the video. Times between them stretch or compress; one undo step.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={addFromPlayhead} disabled={selectedIndex < 0 || !cues.length}>
          <Plus className="size-3.5" aria-hidden />
          Add point at playhead
        </Button>
        <span className="text-xs text-muted-foreground">
          {selectedIndex < 0 ? (
            "Select a line, scrub the video, then add."
          ) : (
            <>
              Line {selectedIndex + 1} · playhead <span ref={playheadRef} className="tabular-nums" />
            </>
          )}
        </span>
      </div>

      <div className="max-h-40 overflow-auto rounded-md border border-border">
        {sorted.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">No sync points yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-medium">Line</th>
                <th className="px-2 py-1.5 font-medium">Subtitle</th>
                <th className="px-2 py-1.5 font-medium">→ Video</th>
                <th className="px-2 py-1.5 font-medium sr-only">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => (
                <tr key={a.index} className="border-t border-border">
                  <td className="px-2 py-1.5 tabular-nums">{a.index + 1}</td>
                  <td className="px-2 py-1.5 tabular-nums">
                    <button
                      type="button"
                      className="text-left hover:underline"
                      title="Seek to subtitle start"
                      onClick={() => seekCue(a.index)}
                    >
                      {formatTime(a.subTime, fmt)}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">
                    <button
                      type="button"
                      className="text-left hover:underline"
                      title="Seek to video time"
                      onClick={() => seekVideo(a.videoTime)}
                    >
                      {formatTime(a.videoTime, fmt)}
                    </button>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex justify-end gap-0.5">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        title="Set video time from playhead"
                        aria-label={`Set line ${a.index + 1} video time from playhead`}
                        onClick={() => setVideoFromPlayhead(a.index)}
                      >
                        <Crosshair className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        title="Play from subtitle"
                        aria-label={`Play line ${a.index + 1}`}
                        onClick={() => {
                          seekCue(a.index);
                          clock.play();
                        }}
                      >
                        <Play className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        title="Remove point"
                        aria-label={`Remove sync point for line ${a.index + 1}`}
                        onClick={() => remove(a.index)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {anchors.length >= 2 && !mono && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
          Video times must increase with the subtitle order.
        </p>
      )}

      <div role="status" aria-live="polite" className="min-h-24 max-h-48 overflow-auto rounded-md bg-muted px-3 py-2 text-xs">
        {!pts ? (
          <p className="text-muted-foreground">Add at least two sync points to preview.</p>
        ) : !mono ? (
          <p className="text-muted-foreground">Fix the video order to see a preview.</p>
        ) : previewRows.length === 0 ? (
          <p className="text-muted-foreground">Nothing would change.</p>
        ) : (
          <div className="space-y-1">
            <p className="text-muted-foreground">
              {changed} line{changed === 1 ? "" : "s"} move · showing {previewRows.length} between anchors
            </p>
            <table className="w-full tabular-nums">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="pr-2 font-medium">#</th>
                  <th className="pr-2 font-medium">Start</th>
                  <th className="font-medium">End</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map(({ i, before, after }) => (
                  <tr key={i}>
                    <td className="pr-2 align-top">{i + 1}</td>
                    <td className="pr-2 align-top">
                      {formatTime(before.start, fmt)} →{" "}
                      <span className="font-medium">{formatTime(after.start, fmt)}</span>
                    </td>
                    <td className="align-top">
                      {formatTime(before.end, fmt)} →{" "}
                      <span className="font-medium">{formatTime(after.end, fmt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button onClick={apply} disabled={!canApply}>
          Apply
        </Button>
      </DialogFooter>
    </>
  );
}

/** SYN-02: map ≥2 subtitle anchors onto video times (piecewise linear). */
export function VisualSyncDialog() {
  const open = useSyncUi((s) => s.visualOpen);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">{open && <VisualSyncForm />}</DialogContent>
    </Dialog>
  );
}
