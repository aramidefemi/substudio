import { CircleCheck, TriangleAlert } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clock } from "@/features/playback/clock";
import { listIssues, type IssueColumn } from "@/features/subtitles/rules";
import { select, selectTimeFormat, useSubtitles } from "@/features/subtitles/store";
import { formatTime } from "@/features/subtitles/timecode";
import { cn } from "@/lib/utils";
import { useUi } from "./actions";

const COLUMN_LABEL: Record<IssueColumn, string> = { start: "Start", duration: "Duration", text: "Text" };

/**
 * List errors (RUL-02): every cue the quality rules flag, with the reason.
 * Recomputed from the document on every change; click a row to jump to the cue.
 */
export function ErrorsPanel() {
  const open = useUi((s) => s.errorsOpen);
  const cues = useSubtitles((s) => s.cues);
  const selectedId = useSubtitles((s) => s.selectedId);
  const fmt = useSubtitles(useShallow(selectTimeFormat));
  const issues = open ? listIssues(cues) : [];
  const lines = new Set(issues.map((i) => i.index)).size;

  return (
    <Dialog modal={false} open={open} onOpenChange={(errorsOpen) => useUi.setState({ errorsOpen })}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="top-auto right-4 bottom-12 left-auto flex max-h-[60vh] max-w-[calc(100%-2rem)] translate-x-0 translate-y-0 flex-col gap-3 p-4 shadow-lg sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Errors</DialogTitle>
          <DialogDescription>
            {issues.length
              ? `${issues.length} problem${issues.length === 1 ? "" : "s"} on ${lines} line${lines === 1 ? "" : "s"}`
              : "No problems found"}
          </DialogDescription>
        </DialogHeader>
        {issues.length === 0 ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <CircleCheck aria-hidden className="size-4" />
            Timing, reading speed and line length are within the limits.
          </p>
        ) : (
          <ul aria-label="Problems" className="-mx-1 min-h-0 flex-1 overflow-auto">
            {issues.map((issue) => {
              const cue = cues[issue.index]!;
              const selected = cue.id === selectedId;
              return (
                <li key={`${cue.id}:${issue.column}`}>
                  <button
                    type="button"
                    onClick={() => {
                      select(cue.id);
                      clock.seek(cue.start);
                    }}
                    className={cn(
                      "grid h-(--row-h) w-full grid-cols-[40px_96px_64px_minmax(0,1fr)] items-center gap-2 rounded-md px-1 text-left tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected ? "bg-row-selected" : "hover:bg-row-hover",
                    )}
                  >
                    <span className="text-muted-foreground">{issue.index + 1}</span>
                    <span className="text-xs text-muted-foreground">{formatTime(cue.start, fmt)}</span>
                    <span className="text-xs font-medium">{COLUMN_LABEL[issue.column]}</span>
                    <span className="flex min-w-0 items-center gap-1.5 text-cell-error-foreground">
                      <TriangleAlert aria-hidden className="size-3 shrink-0" />
                      <span className="truncate" title={issue.reason}>
                        {issue.reason}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
