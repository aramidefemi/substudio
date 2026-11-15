import { TriangleAlert } from "lucide-react";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { selectTimeFormat, useSubtitles } from "@/features/subtitles/store";
import {
  countClamped,
  formatOffset,
  indicesOf,
  parseOffset,
  scopeIndices,
  shiftedTimes,
  type ShiftScope,
} from "@/features/subtitles/retime";
import { shiftByOffset } from "@/features/subtitles/retimeEdits";
import { formatTime } from "@/features/subtitles/timecode";
import { closeAdjustTimes as close, useRetimeUi } from "./retimeUi";

const SCOPES: { value: ShiftScope; label: string }[] = [
  { value: "all", label: "All lines" },
  { value: "selected", label: "Selected" },
  { value: "selectedAndFollowing", label: "Selected and following" },
];

function AdjustTimesForm() {
  const fmt = useSubtitles(useShallow(selectTimeFormat));
  const cues = useSubtitles((s) => s.cues);
  const selectedIds = useSubtitles((s) => s.selectedIds);
  const selectedCount = selectedIds.length;
  const last = useRetimeUi.getState();
  const [value, setValue] = useState(() => last.lastOffset || formatTime(0, fmt));
  const [negative, setNegative] = useState(last.lastNegative);
  const [scope, setScope] = useState<ShiftScope>(
    () => last.lastScope ?? (useSubtitles.getState().selectedIds.length > 1 ? "selected" : "all"),
  );

  const delta = parseOffset(`${negative ? "-" : "+"}${value}`, fmt);
  const indices = scopeIndices(cues.length, indicesOf(cues, selectedIds), scope);
  const first = indices[0] !== undefined ? cues[indices[0]] : undefined;
  const moved = first && delta !== null ? shiftedTimes(first, delta) : null;
  const clamped = delta !== null && delta < 0 ? countClamped(cues, indices, delta) : 0;
  const canApply = delta !== null && delta !== 0 && indices.length > 0;

  const onType = (raw: string) => {
    // A sign typed in the box flips the sign button instead of staying in the text.
    const m = /^\s*([-−+])/.exec(raw);
    if (m) setNegative(m[1] !== "+");
    setValue(m ? raw.slice(m[0].length) : raw);
  };

  const apply = () => {
    if (!canApply) return;
    const n = shiftByOffset(scope, delta);
    useRetimeUi.setState({ lastOffset: value.trim(), lastNegative: negative, lastScope: scope });
    toast.success(`Shifted ${n} line${n === 1 ? "" : "s"} by ${formatOffset(delta, fmt)}`);
    close();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Adjust times</DialogTitle>
        <DialogDescription>Shift lines earlier (−) or later (+). One undo step.</DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-3">
        <label htmlFor="adjust-offset" className="text-xs font-medium">
          Offset
        </label>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-9 shrink-0 text-base tabular-nums"
            aria-label={negative ? "Earlier (minus). Click for later" : "Later (plus). Click for earlier"}
            title="Earlier (−) or later (+). Typing − or + also switches it."
            onClick={() => setNegative((v) => !v)}
          >
            {negative ? "−" : "+"}
          </Button>
          <Input
            id="adjust-offset"
            autoFocus
            spellCheck={false}
            className="h-8 tabular-nums"
            placeholder={fmt.mode === "frames" ? "hh:mm:ss:ff" : "hh:mm:ss,mmm"}
            aria-invalid={delta === null || undefined}
            value={value}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              apply();
            }}
          />
        </div>

        <span className="text-xs font-medium">Lines</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Lines to shift"
          value={scope}
          onValueChange={(v) => v && setScope(v as ShiftScope)}
        >
          {SCOPES.map((s) => (
            <ToggleGroupItem
              key={s.value}
              value={s.value}
              className="h-8 px-2 text-xs"
              disabled={s.value !== "all" && selectedCount === 0}
            >
              {s.label}
              {s.value === "selected" && selectedCount > 0 ? ` (${selectedCount})` : ""}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div role="status" aria-live="polite" className="min-h-14 rounded-md bg-muted px-3 py-2 text-xs">
        {delta === null ? (
          <p className="text-muted-foreground">
            Type an offset like {fmt.mode === "frames" ? "00:00:02:12 or 2:12" : "00:00:02,480 or 2,480"}.
          </p>
        ) : first && moved ? (
          <div className="space-y-1 tabular-nums">
            <p className="text-muted-foreground">
              {indices.length} line{indices.length === 1 ? "" : "s"} · first is line {indices[0]! + 1}
            </p>
            <p>
              <span className="inline-block w-9 text-muted-foreground">Start</span>
              {formatTime(first.start, fmt)} → <span className="font-medium">{formatTime(moved.start, fmt)}</span>
            </p>
            <p>
              <span className="inline-block w-9 text-muted-foreground">End</span>
              {formatTime(first.end, fmt)} → <span className="font-medium">{formatTime(moved.end, fmt)}</span>
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">No lines to shift.</p>
        )}
      </div>
      {clamped > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
          {clamped} line{clamped === 1 ? "" : "s"} would start before zero and stop at {formatTime(0, fmt)}.
        </p>
      )}

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

/** SYN-01: shift all, selected, or selected-and-following lines by a typed offset. */
export function AdjustTimesDialog() {
  const open = useRetimeUi((s) => s.adjustOpen);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">{open && <AdjustTimesForm />}</DialogContent>
    </Dialog>
  );
}
