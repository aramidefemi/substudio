import { Italic } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { toggleItalicAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSettings } from "@/features/settings/store";
import { CUE_TEXT_ID } from "@/lib/dom";
import { cn } from "@/lib/utils";
import { cueStats, DEFAULT_RULES } from "./rules";
import { selectRelative, selectSelectedCue, selectTimeFormat, updateCue, useSubtitles } from "./store";
import { formatDuration, formatTime, nudgeStep, parseDuration, parseTime } from "./timecode";

interface TimeFieldProps {
  id: string;
  label: string;
  value: number;
  format: (t: number) => string;
  parse: (s: string) => number | null;
  step: number;
  disabled: boolean;
  onCommit: (t: number) => void;
}

/** Edits a time as text; commits on Enter/blur, reverts on Escape, ↑/↓ nudge by one step. */
function TimeField({ id, label, value, format, parse, step, disabled, onCommit }: TimeFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const t = parse(draft);
    if (t !== null && t >= 0) onCommit(t);
    setDraft(null);
  };
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      <Input
        id={id}
        disabled={disabled}
        spellCheck={false}
        className="h-8 font-normal tabular-nums"
        value={draft ?? (disabled ? "" : format(value))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") setDraft(null);
          else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            setDraft(null);
            onCommit(Math.max(0, value + (e.key === "ArrowUp" ? step : -step)));
          }
        }}
      />
    </div>
  );
}

export function CueEditor() {
  const cue = useSubtitles(selectSelectedCue);
  const fmt = useSubtitles(useShallow(selectTimeFormat));
  const hideText = useSettings((s) => s.privacy) === "text";
  const disabled = !cue || hideText;
  const stats = cue ? cueStats(cue) : null;
  const step = nudgeStep(fmt);

  return (
    <div className="grid h-full grid-cols-[150px_minmax(0,1fr)] gap-4 overflow-auto rounded-xl bg-card p-3">
      <div className="flex flex-col gap-2">
        <TimeField
          id="cue-start"
          label="Start"
          value={cue?.start ?? 0}
          format={(t) => formatTime(t, fmt)}
          parse={(s) => parseTime(s, fmt)}
          step={step}
          disabled={disabled}
          // Moving the start keeps the duration, like Subtitle Edit.
          onCommit={(t) => cue && updateCue(cue.id, { start: t, end: t + (cue.end - cue.start) })}
        />
        <TimeField
          id="cue-end"
          label="End"
          value={cue?.end ?? 0}
          format={(t) => formatTime(t, fmt)}
          parse={(s) => parseTime(s, fmt)}
          step={step}
          disabled={disabled}
          onCommit={(t) => cue && t > cue.start && updateCue(cue.id, { end: t })}
        />
        <TimeField
          id="cue-duration"
          label="Duration"
          value={cue ? cue.end - cue.start : 0}
          format={(d) => formatDuration(d, fmt)}
          parse={(s) => parseDuration(s, fmt)}
          step={step}
          disabled={disabled}
          onCommit={(d) => cue && d > 0 && updateCue(cue.id, { end: cue.start + d })}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <label htmlFor={CUE_TEXT_ID} className="font-medium">
              Text
            </label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Italic (⌘I)"
                  disabled={disabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={toggleItalicAction}
                  className="size-6"
                >
                  <Italic className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Italic (⌘I)</TooltipContent>
            </Tooltip>
          </div>
          {stats && (
            <span className={cn("tabular-nums text-muted-foreground", stats.cps > DEFAULT_RULES.maxCps && "font-medium text-destructive")}>
              Chars: {stats.chars} / {stats.cps.toFixed(1)} cps
            </span>
          )}
        </div>
        <Textarea
          id={CUE_TEXT_ID}
          disabled={disabled}
          value={hideText ? "••••" : (cue?.text ?? "")}
          placeholder={!cue ? "Select a subtitle" : hideText ? "Hidden by screen privacy" : ""}
          onChange={(e) => cue && !hideText && updateCue(cue.id, { text: e.target.value }, `text:${cue.id}`)}
          onKeyDown={(e) => {
            if (e.key === "Escape") e.currentTarget.blur();
            // ⌘↩ next line; ⌘⇧↩ is the "go to next line and play" command.
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
              e.preventDefault();
              selectRelative(1);
            }
          }}
          className="min-h-0 flex-1 resize-none text-[15px] font-medium leading-snug"
        />
        {stats && (
          <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
            <span className={cn(stats.longestLine > DEFAULT_RULES.maxLineLength && "font-medium text-destructive")}>
              Line length: {stats.lineLengths.join(" / ")}
            </span>
            <span>Total chars: {stats.chars}</span>
          </div>
        )}
      </div>
    </div>
  );
}
