import { Bot, Italic, Scale, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { toggleItalicAction } from "@/app/actions";
import { commandTitle, runCommand } from "@/app/commands/registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSettings } from "@/features/settings/store";
import { useSpell } from "@/features/spellcheck/store";
import type { SpellIssue } from "@/features/spellcheck/types";
import { CUE_ORIGINAL_ID, CUE_TEXT_ID } from "@/lib/dom";
import { cn } from "@/lib/utils";
import { useRules } from "./activeRules";
import { hasOriginal } from "./original";
import { checkCue, cueStats } from "./rules";
import {
  isUntimed,
  selectRelative,
  selectSelectedCue,
  selectTimeFormat,
  updateCue,
  updateOriginal,
  useSubtitles,
} from "./store";
import { timesForUntimed } from "./timing";
import { formatDuration, formatTime, nudgeStep, parseDuration, parseTime } from "./timecode";

function SpellOverlay({ text, issues }: { text: string; issues: SpellIssue[] }) {
  if (!issues.length) return null;
  const parts: { t: string; bad: boolean }[] = [];
  let i = 0;
  const sorted = [...issues].sort((a, b) => a.start - b.start);
  for (const issue of sorted) {
    if (issue.start < i) continue;
    if (issue.start > i) parts.push({ t: text.slice(i, issue.start), bad: false });
    parts.push({ t: text.slice(issue.start, issue.end), bad: true });
    i = issue.end;
  }
  if (i < text.length) parts.push({ t: text.slice(i), bad: false });
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden px-2.5 py-2 text-[15px] leading-snug font-medium whitespace-pre-wrap text-transparent"
    >
      {parts.map((p, idx) =>
        p.bad ? (
          <span key={idx} className="underline decoration-destructive decoration-2 underline-offset-2">
            {p.t}
          </span>
        ) : (
          <span key={idx}>{p.t}</span>
        ),
      )}
    </div>
  );
}

interface TimeFieldProps {
  id: string;
  label: string;
  value: number;
  format: (t: number) => string;
  parse: (s: string) => number | null;
  step: number;
  disabled: boolean;
  /** Problem reason; tints the field like a problem cell in the list. */
  issue?: string;
  onCommit: (t: number) => void;
}

/** Edits a time as text; commits on Enter/blur, reverts on Escape, ↑/↓ nudge by one step. */
function TimeField({ id, label, value, format, parse, step, disabled, issue, onCommit }: TimeFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const t = parse(draft);
    if (t !== null && t >= 0) onCommit(t);
    setDraft(null);
  };
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-center gap-1 text-xs font-medium">
        {label}
        {issue && <TriangleAlert aria-label={issue} className="size-3 text-destructive" />}
      </label>
      <Input
        id={id}
        disabled={disabled}
        spellCheck={false}
        title={issue}
        className={cn(
          "h-8 font-normal tabular-nums",
          issue && "bg-cell-error text-cell-error-foreground dark:bg-cell-error",
        )}
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

/** A readout like "Line length: 45" that turns into a problem chip (tint + icon + reason) when over a limit. */
function Stat({ issue, children }: { issue?: string; children: React.ReactNode }) {
  return (
    <span
      title={issue}
      className={cn(
        "inline-flex items-center gap-1 rounded px-1 tabular-nums",
        issue ? "bg-cell-error font-medium text-cell-error-foreground" : "text-muted-foreground",
      )}
    >
      {issue && <TriangleAlert aria-label={issue} className="size-3" />}
      {children}
    </span>
  );
}

/** Square icon button in the column beside the text box. */
function SideButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-label={label}
          disabled={disabled}
          // Keep focus (and the selection) in the text box.
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          className="size-8 [&_svg]:size-4"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

export function CueEditor() {
  const cue = useSubtitles(selectSelectedCue);
  const cueIndex = useSubtitles((s) => (cue ? s.cues.findIndex((c) => c.id === cue.id) : -1));
  const fmt = useSubtitles(useShallow(selectTimeFormat));
  const showOriginal = useSettings((s) => s.showOriginalColumn);
  const hideText = useSettings((s) => s.privacy) === "text";
  const spellOn = useSpell((s) => s.enabled);
  const liveIssues = useSpell((s) => s.liveIssues);
  const spellIssues = useMemo(
    () => (spellOn && cueIndex >= 0 ? (liveIssues[cueIndex] ?? []) : []),
    [spellOn, cueIndex, liveIssues],
  );
  const disabled = !cue || hideText;
  const untimed = cue ? isUntimed(cue) : false;
  const stats = cue && !untimed ? cueStats(cue) : null;
  const rules = useRules();
  const prev = useSubtitles((s) => (cueIndex > 0 ? s.cues[cueIndex - 1] : undefined));
  const issues = cue ? checkCue(cue, prev, rules) : {};
  const cpsIssue = stats && stats.cps > rules.maxCps ? `Reads too fast: ${stats.cps.toFixed(1)} chars/sec (max ${rules.maxCps})` : undefined;
  const lineIssue =
    stats && stats.longestLine > rules.maxLineLength
      ? `Line too long: ${stats.longestLine} chars (max ${rules.maxLineLength})`
      : stats && stats.lineCount > rules.maxLines
        ? `Too many lines: ${stats.lineCount} (max ${rules.maxLines})`
        : undefined;
  const step = nudgeStep(fmt);
  const timeLabel = (base: string) => (untimed ? `${base} (untimed)` : base);
  const originalOpen = showOriginal || (cue ? hasOriginal(cue) : false);

  return (
    <div className="grid h-full grid-cols-[150px_minmax(0,1fr)_auto] grid-rows-[minmax(0,1fr)] gap-4 overflow-auto rounded-xl bg-card p-3">
      <div className="flex flex-col gap-2">
        <TimeField
          id="cue-start"
          label={timeLabel("Show")}
          value={cue?.start ?? 0}
          format={(t) => (untimed ? "—" : formatTime(t, fmt))}
          parse={(s) => parseTime(s, fmt)}
          step={step}
          disabled={disabled}
          issue={issues.start}
          // Moving the start keeps the duration, like Subtitle Edit's Show field.
          onCommit={(t) => {
            if (!cue) return;
            if (untimed) updateCue(cue.id, timesForUntimed(t, "start"));
            else updateCue(cue.id, { start: t, end: t + Math.max(cue.end - cue.start, 2) });
          }}
        />
        <TimeField
          id="cue-duration"
          label={timeLabel("Duration")}
          value={cue ? cue.end - cue.start : 0}
          format={(d) => (untimed ? "Untimed" : formatDuration(d, fmt))}
          parse={(s) => parseDuration(s, fmt)}
          step={step}
          disabled={disabled}
          issue={issues.duration}
          onCommit={(d) => {
            if (!cue || d <= 0) return;
            if (untimed) updateCue(cue.id, { start: 0, end: d });
            else updateCue(cue.id, { end: cue.start + d });
          }}
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-1">
        {originalOpen && (
          <div className="flex min-h-0 flex-1 flex-col gap-1">
            <label htmlFor={CUE_ORIGINAL_ID} className="text-xs font-medium text-muted-foreground">
              Original
            </label>
            <Textarea
              id={CUE_ORIGINAL_ID}
              disabled={disabled}
              value={hideText ? "••••" : (cue?.original ?? "")}
              placeholder={
                !cue
                  ? "Select a subtitle"
                  : hideText
                    ? "Hidden by screen privacy"
                    : "Source / script text"
              }
              onChange={(e) => cue && !hideText && updateOriginal(cue.id, e.target.value, `original:${cue.id}`)}
              className="min-h-0 flex-1 resize-none text-[15px] font-medium leading-snug text-muted-foreground"
            />
          </div>
        )}
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
          {stats && <Stat issue={cpsIssue}>Chars/sec: {stats.cps.toFixed(1)}</Stat>}
        </div>
        <div className="relative min-h-10 flex-1">
          {!hideText && cue && <SpellOverlay text={cue.text} issues={spellIssues} />}
          <Textarea
            id={CUE_TEXT_ID}
            disabled={disabled}
            spellCheck={false}
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
            className="h-full min-h-0 resize-none [field-sizing:fixed] bg-transparent text-[15px] font-medium leading-snug"
          />
        </div>
        {stats && (
          <div className="flex justify-between text-xs">
            <Stat issue={lineIssue}>Line length: {stats.lineLengths.join(" / ")}</Stat>
            <Stat>Total chars: {stats.chars}</Stat>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 pt-5">
        <SideButton label={commandTitle("edit.autoBreak", "Auto-break selected lines")} disabled={disabled} onClick={() => runCommand("edit.autoBreak")}>
          <Scale />
        </SideButton>
        <SideButton label="AI suggestion (coming soon)" disabled={disabled} onClick={() => toast("AI suggestions are coming soon.")}>
          <Bot />
        </SideButton>
      </div>
    </div>
  );
}
