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
  COMMON_FPS,
  countScaled,
  frameRateFactor,
  indicesOf,
  parsePositive,
  scaledTimes,
  scopeIndices,
  type ShiftScope,
} from "@/features/subtitles/retime";
import { changeFrameRate } from "@/features/subtitles/retimeEdits";
import { formatTime } from "@/features/subtitles/timecode";
import { closeChangeFrameRate as close, useRetimeUi } from "./retimeUi";

const SCOPES: { value: ShiftScope; label: string }[] = [
  { value: "all", label: "All lines" },
  { value: "selected", label: "Selected" },
];

function FrameRateForm() {
  const fmt = useSubtitles(useShallow(selectTimeFormat));
  const projectFps = useSubtitles((s) => s.fps);
  const cues = useSubtitles((s) => s.cues);
  const selectedIds = useSubtitles((s) => s.selectedIds);
  const selectedCount = selectedIds.length;
  const last = useRetimeUi.getState();
  const [fromText, setFromText] = useState(() => last.lastFromFps || String(projectFps));
  const [toText, setToText] = useState(() => last.lastToFps || "");
  const [scope, setScope] = useState<ShiftScope>(
    () => (last.lastScope === "selected" && selectedCount ? "selected" : "all"),
  );

  const fromFps = parsePositive(fromText);
  const toFps = parsePositive(toText);
  const factor = fromFps !== null && toFps !== null ? frameRateFactor(fromFps, toFps) : null;
  const indices = scopeIndices(cues.length, indicesOf(cues, selectedIds), scope);
  const first = indices[0] !== undefined ? cues[indices[0]] : undefined;
  const moved = first && factor !== null ? scaledTimes(first, factor) : null;
  const changed = factor !== null ? countScaled(cues, indices, factor) : 0;
  const canApply = factor !== null && indices.length > 0 && (factor !== 1 || (scope === "all" && toFps !== projectFps));

  const apply = () => {
    if (fromFps === null || toFps === null || !canApply) return;
    const n = changeFrameRate(scope, fromFps, toFps);
    useRetimeUi.setState({ lastFromFps: fromText.trim(), lastToFps: toText.trim(), lastScope: scope });
    if (n === 0 && scope === "all") {
      toast.success(`Project frame rate set to ${toFps} fps`);
    } else {
      toast.success(
        `Rescaled ${n} line${n === 1 ? "" : "s"} ${fromFps} → ${toFps} fps` +
          (scope === "all" ? ` · project fps ${toFps}` : ""),
      );
    }
    close();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Change frame rate</DialogTitle>
        <DialogDescription>
          Rescale times by from÷to (same as Subtitle Edit). Updating all lines also sets the project fps.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-3">
        <label htmlFor="fps-from" className="text-xs font-medium">
          From
        </label>
        <div className="flex gap-1.5">
          <Input
            id="fps-from"
            autoFocus
            spellCheck={false}
            className="h-8 tabular-nums"
            inputMode="decimal"
            value={fromText}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setFromText(e.target.value)}
            aria-invalid={fromFps === null || undefined}
          />
          <span className="self-center text-xs text-muted-foreground">fps</span>
        </div>

        <label htmlFor="fps-to" className="text-xs font-medium">
          To
        </label>
        <div className="flex gap-1.5">
          <Input
            id="fps-to"
            spellCheck={false}
            className="h-8 tabular-nums"
            inputMode="decimal"
            placeholder="e.g. 23.976"
            value={toText}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setToText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              apply();
            }}
            aria-invalid={toFps === null || undefined}
          />
          <span className="self-center text-xs text-muted-foreground">fps</span>
        </div>

        <span className="text-xs font-medium">Lines</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Lines to rescale"
          value={scope}
          onValueChange={(v) => v && setScope(v as ShiftScope)}
        >
          {SCOPES.map((s) => (
            <ToggleGroupItem
              key={s.value}
              value={s.value}
              className="h-8 px-2 text-xs"
              disabled={s.value === "selected" && selectedCount === 0}
            >
              {s.label}
              {s.value === "selected" && selectedCount > 0 ? ` (${selectedCount})` : ""}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {COMMON_FPS.map((fps) => (
          <Button
            key={fps}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs tabular-nums"
            onClick={() => setToText(String(fps))}
          >
            {fps}
          </Button>
        ))}
      </div>

      <div role="status" aria-live="polite" className="min-h-14 rounded-md bg-muted px-3 py-2 text-xs">
        {factor === null ? (
          <p className="text-muted-foreground">Enter two positive frame rates.</p>
        ) : first && moved ? (
          <div className="space-y-1 tabular-nums">
            <p className="text-muted-foreground">
              ×{factor.toFixed(6).replace(/\.?0+$/, "")} · {changed} of {indices.length} line
              {indices.length === 1 ? "" : "s"} change
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
          <p className="text-muted-foreground">No lines to rescale.</p>
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

/** SYN-03: rescale subtitle times from one fps to another. */
export function ChangeFrameRateDialog() {
  const open = useRetimeUi((s) => s.frameRateOpen);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">{open && <FrameRateForm />}</DialogContent>
    </Dialog>
  );
}
