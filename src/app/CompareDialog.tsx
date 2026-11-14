import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { compareCues, diffSummary, type CueDiffRow } from "@/features/subtitles/compare";
import { selectTimeFormat, useSubtitles } from "@/features/subtitles/store";
import { formatTime } from "@/features/subtitles/timecode";
import type { CueData } from "@/features/subtitles/types";
import { fileName } from "@/lib/tauri";
import { useUi } from "./actions";

function kindClass(kind: CueDiffRow["kind"]) {
  if (kind === "same") return "bg-transparent";
  if (kind === "changed") return "bg-accent/60";
  return "bg-cell-error-bg/60";
}

function CueCell({ cue, fmt }: { cue: CueData | null; fmt: ReturnType<typeof selectTimeFormat> }) {
  if (!cue) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="min-w-0">
      <div className="text-xs tabular-nums text-muted-foreground">
        {formatTime(cue.start, fmt)} → {formatTime(cue.end, fmt)}
      </div>
      <div className="truncate text-sm whitespace-pre-wrap">{cue.text || "—"}</div>
    </div>
  );
}

/** Tools → Compare: side-by-side diff vs another subtitle file. */
export function CompareDialog() {
  const open = useUi((s) => s.compareOpen);
  const left = useSubtitles((s) => s.cues);
  const leftPath = useSubtitles((s) => s.filePath);
  const fmt = useSubtitles(useShallow(selectTimeFormat));
  const other = useUi((s) => s.compareOther);
  const [hideSame, setHideSame] = useState(false);

  const setOpen = (compareOpen: boolean) => {
    if (!compareOpen) useUi.setState({ compareOpen: false, compareOther: null });
    else useUi.setState({ compareOpen: true });
  };

  const rows = useMemo(
    () => (other ? compareCues(left, other.cues) : []),
    [left, other],
  );
  const summary = useMemo(() => diffSummary(rows), [rows]);
  const visible = hideSame ? rows.filter((r) => r.kind !== "same") : rows;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Compare</DialogTitle>
          <DialogDescription>
            {other
              ? `${fileName(leftPath ?? "Untitled")} vs ${fileName(other.path)}`
              : "Open another subtitle file to compare."}
          </DialogDescription>
        </DialogHeader>
        {other && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>
                Same {summary.same} · Changed {summary.changed} · Only left {summary.onlyLeft} · Only
                right {summary.onlyRight}
              </span>
              <Button size="sm" variant="outline" onClick={() => setHideSame((v) => !v)}>
                {hideSame ? "Show all" : "Hide identical"}
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                  <tr>
                    <th className="w-10 px-2 py-1.5">#</th>
                    <th className="w-1/2 px-2 py-1.5">Current</th>
                    <th className="w-1/2 px-2 py-1.5">Other</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((row) => (
                    <tr key={row.index} className={kindClass(row.kind)}>
                      <td className="px-2 py-1.5 align-top tabular-nums text-muted-foreground">
                        {row.index + 1}
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <CueCell cue={row.left} fmt={fmt} />
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <CueCell cue={row.right} fmt={fmt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
