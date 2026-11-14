import { useVirtualizer } from "@tanstack/react-virtual";
import { TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { ROW_HEIGHT, useSettings } from "@/features/settings/store";
import { focusCueText } from "@/lib/dom";
import { cn } from "@/lib/utils";
import { checkCue } from "./rules";
import { select, selectSelectedIndex, selectTimeFormat, useSubtitles } from "./store";
import { formatDuration, formatTime } from "./timecode";

const COLUMNS = "grid grid-cols-[48px_118px_118px_80px_minmax(0,1fr)] items-center";

function Cell({ issue, className, children }: { issue?: string; className?: string; children: React.ReactNode }) {
  return (
    <div
      title={issue}
      className={cn(
        "flex h-full items-center gap-1 truncate px-3",
        issue && "bg-cell-error text-cell-error-foreground",
        className,
      )}
    >
      {issue && <TriangleAlert aria-label={issue} className="size-3 shrink-0" />}
      <span className="truncate">{children}</span>
    </div>
  );
}

export function SubtitleList() {
  "use no memo"; // TanStack Virtual returns a mutable instance that React Compiler can't memoize safely.
  const cues = useSubtitles((s) => s.cues);
  const selectedId = useSubtitles((s) => s.selectedId);
  const selectedIndex = useSubtitles(selectSelectedIndex);
  const fmt = useSubtitles(useShallow(selectTimeFormat));
  const rowHeight = ROW_HEIGHT[useSettings((s) => s.density)];
  const scrollRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library -- opted out with "use no memo"
  const virtualizer = useVirtualizer({
    count: cues.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 16,
  });

  useEffect(() => virtualizer.measure(), [rowHeight, virtualizer]);
  useEffect(() => {
    if (selectedIndex >= 0) virtualizer.scrollToIndex(selectedIndex, { align: "auto" });
  }, [selectedIndex, virtualizer]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <div
        role="row"
        className={cn(COLUMNS, "h-9 shrink-0 border-b text-xs font-medium text-muted-foreground")}
      >
        <span className="px-3">#</span>
        <span className="px-3">Start</span>
        <span className="px-3">End</span>
        <span className="px-3">Duration</span>
        <span className="px-3">Text</span>
      </div>

      <div ref={scrollRef} role="grid" aria-label="Subtitles" className="relative min-h-0 flex-1 overflow-auto">
        {cues.length === 0 && (
          <p className="p-6 text-center text-muted-foreground">
            No subtitles yet. Open a file, or add one from the waveform.
          </p>
        )}
        <div style={{ height: virtualizer.getTotalSize() }} className="relative w-full">
          {virtualizer.getVirtualItems().map((row) => {
            const cue = cues[row.index]!;
            const issues = checkCue(cue, cues[row.index - 1]);
            const selected = cue.id === selectedId;
            return (
              <div
                key={cue.id}
                role="row"
                aria-selected={selected}
                onMouseDown={() => select(cue.id)}
                onDoubleClick={focusCueText}
                style={{ height: row.size, transform: `translateY(${row.start}px)` }}
                className={cn(
                  COLUMNS,
                  "absolute inset-x-0 top-0 border-b border-border/60 tabular-nums",
                  selected ? "bg-row-selected" : "hover:bg-row-hover",
                )}
              >
                <Cell className="text-muted-foreground">{row.index + 1}</Cell>
                <Cell issue={issues.start}>{formatTime(cue.start, fmt)}</Cell>
                <Cell>{formatTime(cue.end, fmt)}</Cell>
                <Cell issue={issues.duration}>{formatDuration(cue.end - cue.start, fmt)}</Cell>
                <Cell issue={issues.text}>{cue.text.replace(/\n/g, " / ") || "—"}</Cell>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
