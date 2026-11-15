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
  countScaled,
  frameRateFactor,
  indicesOf,
  parsePositive,
  scaledTimes,
  scopeIndices,
  type ShiftScope,
} from "@/features/subtitles/retime";
import { rescaleByFactor } from "@/features/subtitles/retimeEdits";
import { formatTime } from "@/features/subtitles/timecode";
import { closeChangeSpeed as close, useRetimeUi } from "./retimeUi";

const SCOPES: { value: ShiftScope; label: string }[] = [
  { value: "all", label: "All lines" },
  { value: "selected", label: "Selected" },
];

const PRESETS: { label: string; factor: number }[] = [
  { label: "25 → 23.976", factor: 25 / 23.976 },
  { label: "23.976 → 25", factor: 23.976 / 25 },
  { label: "25 → 24", factor: 25 / 24 },
  { label: "24 → 25", factor: 24 / 25 },
];

function SpeedForm() {
  const fmt = useSubtitles(useShallow(selectTimeFormat));
  const cues = useSubtitles((s) => s.cues);
  const selectedIds = useSubtitles((s) => s.selectedIds);
  const selectedCount = selectedIds.length;
  const last = useRetimeUi.getState();
  const [factorText, setFactorText] = useState(() => last.lastSpeedFactor || "1");
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const [scope, setScope] = useState<ShiftScope>(
    () => (last.lastScope === "selected" && selectedCount ? "selected" : "all"),
  );

  const fromRate = parsePositive(fromText);
  const toRate = parsePositive(toText);
  const fromTo = fromRate !== null && toRate !== null ? frameRateFactor(fromRate, toRate) : null;
  const factor = fromTo ?? parsePositive(factorText);
  const indices = scopeIndices(cues.length, indicesOf(cues, selectedIds), scope);
  const first = indices[0] !== undefined ? cues[indices[0]] : undefined;
  const moved = first && factor !== null ? scaledTimes(first, factor) : null;
  const changed = factor !== null ? countScaled(cues, indices, factor) : 0;
  const canApply = factor !== null && factor !== 1 && indices.length > 0;

  const apply = () => {
    if (factor === null || !canApply) return;
    const n = rescaleByFactor(scope, factor);
    useRetimeUi.setState({ lastSpeedFactor: String(factor), lastScope: scope });
    toast.success(`Scaled ${n} line${n === 1 ? "" : "s"} ×${factor.toFixed(6).replace(/\.?0+$/, "")}`);
    close();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Change speed</DialogTitle>
        <DialogDescription>
          Multiply all start/end times by a factor (or from÷to rates). Does not change the project fps.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-3">
        <label htmlFor="speed-factor" className="text-xs font-medium">
          Factor
        </label>
        <Input
          id="speed-factor"
          autoFocus
          spellCheck={false}
          className="h-8 tabular-nums"
          inputMode="decimal"
          value={factorText}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            setFactorText(e.target.value);
            setFromText("");
            setToText("");
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            apply();
          }}
          aria-invalid={(fromTo === null && parsePositive(factorText) === null) || undefined}
        />

        <span className="text-xs font-medium">Or rates</span>
        <div className="flex items-center gap-1.5">
          <Input
            aria-label="From rate"
            spellCheck={false}
            className="h-8 tabular-nums"
            inputMode="decimal"
            placeholder="from"
            value={fromText}
            onChange={(e) => {
              setFromText(e.target.value);
              const a = parsePositive(e.target.value);
              const b = parsePositive(toText);
              if (a !== null && b !== null) setFactorText(String(a / b));
            }}
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            aria-label="To rate"
            spellCheck={false}
            className="h-8 tabular-nums"
            inputMode="decimal"
            placeholder="to"
            value={toText}
            onChange={(e) => {
              setToText(e.target.value);
              const a = parsePositive(fromText);
              const b = parsePositive(e.target.value);
              if (a !== null && b !== null) setFactorText(String(a / b));
            }}
          />
        </div>

        <span className="text-xs font-medium">Lines</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Lines to scale"
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
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setFactorText(String(p.factor));
              setFromText("");
              setToText("");
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div role="status" aria-live="polite" className="min-h-14 rounded-md bg-muted px-3 py-2 text-xs">
        {factor === null ? (
          <p className="text-muted-foreground">Enter a positive factor (e.g. 1.0427) or from→to rates.</p>
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
          <p className="text-muted-foreground">No lines to scale.</p>
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

/** SYN-03: multiply subtitle times by a speed factor. */
export function ChangeSpeedDialog() {
  const open = useRetimeUi((s) => s.speedOpen);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">{open && <SpeedForm />}</DialogContent>
    </Dialog>
  );
}
