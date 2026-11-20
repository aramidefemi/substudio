import { ArrowLeftRight, ArrowRight, Lock, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { setTranslatePrefs, useSettings } from "@/features/settings/store";
import { useSubtitles } from "@/features/subtitles/store";
import { AUTO_DETECT, ENGINES, languageName, orderedLanguages, type TranslateEngine } from "@/features/translate/languages";
import { buildPlan } from "@/features/translate/plan";
import { resetTranslation, runTranslation, stopTranslation, useTranslateRun } from "@/features/translate/run";
import { announceResult, useTranslateUi, type TranslateScope } from "./autoTranslate";

const plural = (n: number, word = "line") => `${n} ${word}${n === 1 ? "" : "s"}`;
const { suggested, rest } = orderedLanguages();

function LanguageSelect({
  label,
  value,
  onChange,
  allowAuto,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  allowAuto?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full" aria-label={`${label} language`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {allowAuto && (
            <>
              <SelectItem value={AUTO_DETECT.code}>{AUTO_DETECT.name}</SelectItem>
              <SelectSeparator />
            </>
          )}
          <SelectGroup>
            <SelectLabel>Suggested</SelectLabel>
            {suggested.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.name}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>All languages</SelectLabel>
            {rest.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

/** Settings form: language pair, which lines, engine, and what leaves the Mac. */
function SetupForm({ onStart }: { onStart: (scope: TranslateScope) => void }) {
  const prefs = useSettings((s) => s.translate);
  const cues = useSubtitles((s) => s.cues);
  const selectedIds = useSubtitles((s) => s.selectedIds);
  const initialScope = useTranslateUi((s) => s.scope);
  const [scope, setScope] = useState<TranslateScope>(selectedIds.length ? initialScope : "all");

  const plan = useMemo(
    () =>
      buildPlan(cues, {
        scope: scope === "selected" ? new Set(selectedIds) : null,
        skipTranslated: prefs.skipTranslated,
      }),
    [cues, scope, selectedIds, prefs.skipTranslated],
  );
  const count = plan.items.length;
  const needsKey = prefs.engine === "google-cloud" && !prefs.apiKey.trim();
  const sameLanguage = prefs.source === prefs.target;
  const canStart = count > 0 && !needsKey && !sameLanguage;

  const swap = () => setTranslatePrefs({ source: prefs.target, target: prefs.source });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canStart) onStart(scope);
      }}
    >
      <div className="flex items-end gap-2">
        <LanguageSelect label="From" value={prefs.source} allowAuto onChange={(source) => setTranslatePrefs({ source })} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mb-px shrink-0"
          aria-label="Swap languages"
          title="Swap languages"
          disabled={prefs.source === "auto"}
          onClick={swap}
        >
          <ArrowLeftRight className="size-4" />
        </Button>
        <LanguageSelect label="To" value={prefs.target} onChange={(target) => setTranslatePrefs({ target })} />
      </div>

      <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-3 gap-y-3">
        <span className="text-xs font-medium">Lines</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Lines to translate"
          value={scope}
          onValueChange={(v) => v && setScope(v as TranslateScope)}
        >
          <ToggleGroupItem value="all" className="h-8 px-3 text-xs">
            All ({cues.length})
          </ToggleGroupItem>
          <ToggleGroupItem value="selected" className="h-8 px-3 text-xs" disabled={!selectedIds.length}>
            Selected{selectedIds.length ? ` (${selectedIds.length})` : ""}
          </ToggleGroupItem>
        </ToggleGroup>

        {!plan.seedOriginals && (
          <>
            <span aria-hidden />
            <label className="flex items-center gap-2 text-xs">
              <Toggle
                size="sm"
                variant="outline"
                pressed={prefs.skipTranslated}
                onPressedChange={(skipTranslated) => setTranslatePrefs({ skipTranslated })}
                className="h-7 shrink-0 px-2 text-xs"
              >
                {prefs.skipTranslated ? "On" : "Off"}
              </Toggle>
              Keep lines that already have a translation
            </label>
          </>
        )}

        <span className="text-xs font-medium">Engine</span>
        <Select value={prefs.engine} onValueChange={(engine) => setTranslatePrefs({ engine: engine as TranslateEngine })}>
          <SelectTrigger className="w-full" aria-label="Translation engine">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENGINES.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {prefs.engine === "google-cloud" && (
          <>
            <label htmlFor="translate-api-key" className="text-xs font-medium">
              API key
            </label>
            <Input
              id="translate-api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="Google Cloud Translation API key"
              value={prefs.apiKey}
              onChange={(e) => setTranslatePrefs({ apiKey: e.target.value })}
              className="h-8"
            />
          </>
        )}
        <span aria-hidden />
        <p className="-mt-1.5 text-xs text-muted-foreground">
          {ENGINES.find((e) => e.id === prefs.engine)?.detail}
          {prefs.engine === "google-cloud" && " The key is stored on this Mac only."}
        </p>
      </div>

      {/* Where the text goes, so nothing is a surprise. */}
      <div className="flex flex-col gap-2 rounded-md bg-muted px-3 py-2.5 text-xs">
        <p className="flex items-center gap-1.5 font-medium">
          {plan.seedOriginals ? "Text" : "Original"}
          <ArrowRight aria-hidden className="size-3 text-muted-foreground" />
          Text
          <span className="font-normal text-muted-foreground">
            · {languageName(prefs.source)} to {languageName(prefs.target)}
          </span>
        </p>
        <p className="text-muted-foreground">
          {plan.seedOriginals
            ? "Your current text moves to the Original column, so the source stays beside each translation."
            : "Translates the Original column into the Text column."}{" "}
          Translated lines are marked until you edit or accept them.
          {plan.skipped > 0 && ` ${plural(plan.skipped)} skipped (blank, music only or already translated).`}
        </p>
        <p className="flex items-start gap-1.5 text-muted-foreground">
          <Lock aria-hidden className="mt-px size-3 shrink-0" />
          <span>
            Sends the text of {plural(count)} to Google. Video, audio and file names stay on this Mac.
          </span>
        </p>
      </div>

      {sameLanguage && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
          Choose two different languages.
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => useTranslateUi.setState({ open: false })}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canStart}>
          {count ? `Translate ${plural(count)}` : "Nothing to translate"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Progress while batches arrive; lines fill in the list behind the dialog. */
function Progress({ onRetry }: { onRetry: () => void }) {
  const run = useTranslateRun();
  const { source, target } = useSettings((s) => s.translate);
  const pct = run.total ? Math.round((run.done / run.total) * 100) : 0;
  const failed = run.phase === "error";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2" role="status" aria-live="polite">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">
            {failed ? `Stopped after ${plural(run.done)}` : `${languageName(source)} → ${languageName(target)}`}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {run.done} of {run.total}
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={run.total}
          aria-valuenow={run.done}
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        {!failed && <p className="text-xs text-muted-foreground">Lines appear in the list as they arrive.</p>}
      </div>

      {failed && (
        <div className="flex items-start gap-2 rounded-md bg-cell-error px-3 py-2 text-xs text-cell-error-foreground">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          <div className="space-y-1">
            <p>{run.error}</p>
            {run.done > 0 && <p>The {plural(run.done)} already translated are kept. Try again to continue.</p>}
          </div>
        </div>
      )}

      <DialogFooter>
        {failed ? (
          <>
            <Button variant="outline" onClick={() => useTranslateUi.setState({ open: false })}>
              Close
            </Button>
            <Button onClick={onRetry}>Try again</Button>
          </>
        ) : (
          <Button variant="outline" onClick={stopTranslation}>
            Stop
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}

/** Translate › Auto-translate… (TRN-01). */
export function AutoTranslateDialog() {
  const open = useTranslateUi((s) => s.open);
  const autoStart = useTranslateUi((s) => s.autoStart);
  const phase = useTranslateRun((s) => s.phase);
  const lastScope = useRef<TranslateScope>("all");

  const start = async (scope: TranslateScope, resume = false) => {
    lastScope.current = scope;
    const prefs = useSettings.getState().translate;
    const s = useSubtitles.getState();
    setTranslatePrefs({ used: true });
    const result = await runTranslation({
      engine: prefs.engine,
      apiKey: prefs.apiKey,
      source: prefs.source,
      target: prefs.target,
      scope: scope === "selected" ? new Set(s.selectedIds) : null,
      // A retry continues where it stopped.
      skipTranslated: resume || prefs.skipTranslated,
    });
    if (result.phase === "error") return;
    useTranslateUi.setState({ open: false });
    announceResult(result);
    resetTranslation();
  };

  // "Translate selected lines (last settings)" opens straight into progress.
  useEffect(() => {
    if (!open || !autoStart) return;
    useTranslateUi.setState({ autoStart: false });
    void start("selected");
  }, [open, autoStart]);

  const busy = phase === "running" || phase === "error";

  const onOpenChange = (o: boolean) => {
    if (o) return;
    if (phase === "running") stopTranslation();
    else resetTranslation();
    useTranslateUi.setState({ open: false });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Auto-translate</DialogTitle>
          <DialogDescription>
            {busy ? "Translating with Google…" : "Get a first draft of every line, then review it in the editor."}
          </DialogDescription>
        </DialogHeader>
        {open &&
          (busy || autoStart ? (
            <Progress onRetry={() => void start(lastScope.current, true)} />
          ) : (
            <SetupForm onStart={(scope) => void start(scope)} />
          ))}
      </DialogContent>
    </Dialog>
  );
}
