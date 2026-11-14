import { Check, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { useSettings } from "@/features/settings/store";
import { useSubtitles } from "@/features/subtitles/store";
import { commandTitle } from "./commands/registry";
import { findNext, replaceCurrent, replaceEverywhere, setSearch, useFindReplace } from "./findReplace";

function OptionToggle({ label, pressed, onChange }: { label: string; pressed: boolean; onChange: (v: boolean) => void }) {
  return (
    <Toggle size="sm" variant="outline" pressed={pressed} onPressedChange={onChange} className="h-7 px-2 text-xs">
      {pressed && <Check aria-hidden className="size-3" />}
      {label}
    </Toggle>
  );
}

/** The current hit in its line, with the match marked. */
function HitPreview() {
  const current = useFindReplace((s) => s.current);
  const cue = useSubtitles((s) => (current ? s.cues.find((c) => c.id === current.cueId) : undefined));
  const hideText = useSettings((s) => s.privacy) === "text";
  if (!current || !cue || hideText) return null;
  const text = cue.text.replace(/\n/g, " ");
  return (
    <p className="truncate rounded-md bg-muted px-2 py-1.5 text-[13px]">
      {text.slice(0, current.start)}
      <mark className="rounded-sm bg-accent px-0.5 font-semibold text-accent-foreground underline decoration-primary decoration-2 underline-offset-2">
        {text.slice(current.start, current.end)}
      </mark>
      {text.slice(current.end)}
    </p>
  );
}

/**
 * ⌥⌘F: find and replace in subtitle text (EDT-04). Non-modal, so the list and
 * video stay usable while she steps through matches with ⌘G / ⇧⌘G.
 */
export function ReplaceDialog() {
  const open = useFindReplace((s) => s.open);
  const query = useFindReplace((s) => s.query);
  const replacement = useFindReplace((s) => s.replacement);
  const matchCase = useFindReplace((s) => s.matchCase);
  const wholeWord = useFindReplace((s) => s.wholeWord);
  const regex = useFindReplace((s) => s.regex);
  const status = useFindReplace((s) => s.status);
  const isError = status.startsWith("Invalid regular expression");

  return (
    <Dialog modal={false} open={open} onOpenChange={(v) => useFindReplace.setState({ open: v })}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="top-16 right-4 left-auto max-w-[calc(100%-2rem)] translate-x-0 translate-y-0 gap-4 p-4 shadow-lg sm:max-w-sm"
      >
        <DialogHeader>
          <DialogTitle>Find and replace</DialogTitle>
          <DialogDescription className="sr-only">Find and replace text in all subtitles</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
          <label htmlFor="fr-find" className="text-xs font-medium">
            Find
          </label>
          <Input
            id="fr-find"
            autoFocus
            spellCheck={false}
            aria-invalid={isError || undefined}
            className="h-8"
            value={query}
            onChange={(e) => setSearch({ query: e.target.value })}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              findNext(e.shiftKey ? -1 : 1);
            }}
          />
          <label htmlFor="fr-replace" className="text-xs font-medium">
            Replace
          </label>
          <Input
            id="fr-replace"
            spellCheck={false}
            className="h-8"
            value={replacement}
            onChange={(e) => setSearch({ replacement: e.target.value })}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (e.metaKey || e.ctrlKey) replaceEverywhere();
              else replaceCurrent();
            }}
          />
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Search options">
          <OptionToggle label="Match case" pressed={matchCase} onChange={(v) => setSearch({ matchCase: v })} />
          <OptionToggle label="Whole word" pressed={wholeWord} onChange={(v) => setSearch({ wholeWord: v })} />
          <OptionToggle label="Regex" pressed={regex} onChange={(v) => setSearch({ regex: v })} />
        </div>

        <HitPreview />
        <p role="status" aria-live="polite" className={isError ? "flex items-center gap-1.5 text-xs text-destructive" : "min-h-4 text-xs text-muted-foreground"}>
          {isError && <CircleAlert aria-hidden className="size-3.5 shrink-0" />}
          {status}
        </p>

        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" title={commandTitle("edit.findPrevious")} onClick={() => findNext(-1)}>
            Previous
          </Button>
          <Button size="sm" variant="outline" title={commandTitle("edit.findNext")} onClick={() => findNext(1)}>
            Next
          </Button>
          <Button size="sm" variant="outline" title="Replace this match and find the next (Enter in Replace)" onClick={replaceCurrent}>
            Replace
          </Button>
          <Button size="sm" title="Replace every match, one undo step (⌘Enter in Replace)" onClick={replaceEverywhere}>
            Replace all
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
