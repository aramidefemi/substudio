import { useVirtualizer } from "@tanstack/react-virtual";
import { Bookmark, TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { clock } from "@/features/playback/clock";
import { ROW_HEIGHT, useSettings } from "@/features/settings/store";
import { focusCueText, SUBTITLE_LIST_ID } from "@/lib/dom";
import { cn } from "@/lib/utils";
import { formatRuns, gapAfter, stripTags } from "./format";
import { checkCue, cueStats } from "./rules";
import {
  select,
  selectRangeTo,
  selectSelectedIndex,
  selectTimeFormat,
  toggleSelect,
  useSubtitles,
} from "./store";
import { formatDuration, formatTime } from "./timecode";

function columnTemplate(cps: boolean, gap: boolean) {
  const parts = ["48px", "118px", "118px", "80px"];
  if (cps) parts.push("56px");
  if (gap) parts.push("72px");
  parts.push("minmax(0,1fr)");
  return parts.join(" ");
}

function Cell({
  issue,
  className,
  children,
}: {
  issue?: string;
  className?: string;
  children: React.ReactNode;
}) {
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

function GridText({ text, showFormatting }: { text: string; showFormatting: boolean }) {
  const line = text.replace(/\n/g, " / ");
  if (!line) return "—";
  if (!showFormatting) return stripTags(line) || "—";
  return (
    <>
      {formatRuns(line).map((run, i) => (
        <span key={i} className={cn(run.italic && "italic", run.bold && "font-semibold")}>
          {run.text}
        </span>
      ))}
    </>
  );
}

export function SubtitleList() {
  "use no memo"; // TanStack Virtual returns a mutable instance that React Compiler can't memoize safely.
  const cues = useSubtitles((s) => s.cues);
  const selectedIds = useSubtitles((s) => s.selectedIds);
  const selectedIndex = useSubtitles(selectSelectedIndex);
  const fmt = useSubtitles(useShallow(selectTimeFormat));
  const rowHeight = ROW_HEIGHT[useSettings((s) => s.density)];
  const showCps = useSettings((s) => s.showCpsColumn);
  const showGap = useSettings((s) => s.showGapColumn);
  const showFormatting = useSettings((s) => s.showFormattingInGrid);
  const privacy = useSettings((s) => s.privacy);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedSet = new Set(selectedIds);
  const gridTemplateColumns = columnTemplate(showCps, showGap);
  const rowClass = "grid items-center";

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
    <div className="flex h-full flex-col overflow-hidden rounded-xl bg-card">
      <div
        role="row"
        style={{ gridTemplateColumns }}
        className={cn(rowClass, "h-9 shrink-0 border-b text-xs font-medium text-muted-foreground")}
      >
        <span className="px-3">#</span>
        <span className="px-3">Start</span>
        <span className="px-3">End</span>
        <span className="px-3">Duration</span>
        {showCps && <span className="px-3">CPS</span>}
        {showGap && <span className="px-3">Gap</span>}
        <span className="px-3">Text</span>
      </div>

      <div
        ref={scrollRef}
        id={SUBTITLE_LIST_ID}
        tabIndex={0}
        role="grid"
        aria-label="Subtitles"
        className="relative min-h-0 flex-1 overflow-auto outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        {cues.length === 0 && (
          <p className="p-6 text-center text-muted-foreground">
            No subtitles yet. Open a file, or add one from the waveform.
          </p>
        )}
        <div style={{ height: virtualizer.getTotalSize() }} className="relative w-full">
          {virtualizer.getVirtualItems().map((row) => {
            const cue = cues[row.index]!;
            const prev = cues[row.index - 1];
            const issues = checkCue(cue, prev);
            const selected = selectedSet.has(cue.id);
            const stats = cueStats(cue);
            const gap = gapAfter(prev, cue);
            const textHidden = privacy === "text";
            return (
              <div
                key={cue.id}
                role="row"
                aria-selected={selected}
                onMouseDown={(e) => {
                  if (e.shiftKey) selectRangeTo(cue.id);
                  else if (e.metaKey || e.ctrlKey) toggleSelect(cue.id);
                  else {
                    select(cue.id);
                    clock.seek(cue.start);
                  }
                }}
                onDoubleClick={focusCueText}
                style={{ height: row.size, transform: `translateY(${row.start}px)`, gridTemplateColumns }}
                className={cn(
                  rowClass,
                  "absolute inset-x-0 top-0 border-b border-border/60 tabular-nums",
                  selected ? "bg-row-selected" : "hover:bg-row-hover",
                )}
              >
                <Cell className="text-muted-foreground">{row.index + 1}</Cell>
                {cue.bookmark !== undefined && (
                  // Sits in the # cell's left padding so long line numbers never truncate it.
                  <Bookmark
                    role="img"
                    aria-label={cue.bookmark ? `Bookmark: ${cue.bookmark}` : "Bookmarked"}
                    className="pointer-events-auto absolute top-1/2 left-0.5 size-2.5 -translate-y-1/2 fill-current text-primary"
                  >
                    <title>{cue.bookmark ? `Bookmark: ${cue.bookmark}` : "Bookmarked"}</title>
                  </Bookmark>
                )}
                <Cell issue={issues.start}>{formatTime(cue.start, fmt)}</Cell>
                <Cell>{formatTime(cue.end, fmt)}</Cell>
                <Cell issue={issues.duration}>{formatDuration(cue.end - cue.start, fmt)}</Cell>
                {showCps && (
                  <Cell issue={issues.text?.includes("chars/sec") ? issues.text : undefined}>
                    {stats.chars ? stats.cps.toFixed(1) : "—"}
                  </Cell>
                )}
                {showGap && (
                  <Cell>{gap === null ? "—" : formatDuration(Math.max(0, gap), fmt)}</Cell>
                )}
                <Cell issue={issues.text}>
                  {textHidden ? "••••" : <GridText text={cue.text} showFormatting={showFormatting} />}
                </Cell>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
