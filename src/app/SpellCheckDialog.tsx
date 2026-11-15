import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { addSpellWord } from "@/features/spellcheck/store";
import {
  resetSpellSession,
  runSpellSession,
  spellAfterReplace,
  spellDropCurrentWord,
  spellSkip,
  useSpellSession,
} from "@/features/spellcheck/session";
import { edit, useSubtitles } from "@/features/subtitles/store";
import { inTauri } from "@/lib/tauri";
import { useUi } from "./actions";

/** Tools → Spell check with names list / dictionary (QLT-03). */
export function SpellCheckDialog() {
  const open = useUi((s) => s.spellOpen);
  const cues = useSubtitles((s) => s.cues);
  const hits = useSpellSession((s) => s.hits);
  const at = useSpellSession((s) => s.at);
  const engine = useSpellSession((s) => s.engine);
  const suggestions = useSpellSession((s) => s.suggestions);
  const draft = useSpellSession((s) => s.draft);
  const status = useSpellSession((s) => s.status);

  const current = hits[at] ?? null;
  const cue = current ? cues[current.cueIndex] : null;
  const preview = current && cue
    ? {
        before: cue.text.slice(0, current.issue.start),
        word: current.issue.word,
        after: cue.text.slice(current.issue.end),
      }
    : null;

  const setOpen = (v: boolean) => {
    useUi.setState({ spellOpen: v });
    if (!v) resetSpellSession();
  };

  const replaceWord = (replacement: string) => {
    if (!current) return;
    const id = cues[current.cueIndex]?.id;
    if (!id) return;
    const { start, end } = current.issue;
    edit((doc) => {
      const c = doc.cues.find((x) => x.id === id);
      if (!c) return;
      c.text = c.text.slice(0, start) + replacement + c.text.slice(end);
    }, "spell-replace");
    void spellAfterReplace();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Spell check</DialogTitle>
          <DialogDescription>
            {status === "checking"
              ? "Checking…"
              : engine
                ? `Engine: ${engine}`
                : status === "ready"
                  ? "No system spell engine"
                  : "Ready"}{" "}
            · {hits.length} issue{hits.length === 1 ? "" : "s"}
          </DialogDescription>
        </DialogHeader>

        {current && preview ? (
          <div className="space-y-3">
            <p className="rounded-md bg-muted px-2 py-1.5 text-sm whitespace-pre-wrap">
              {preview.before}
              <mark className="rounded-sm bg-accent px-0.5 font-semibold text-accent-foreground">
                {preview.word}
              </mark>
              {preview.after}
            </p>
            <Input
              className="h-8"
              value={draft}
              onChange={(e) => useSpellSession.setState({ draft: e.target.value })}
            />
            <div className="flex flex-wrap gap-1">
              {suggestions.slice(0, 8).map((s) => (
                <Button key={s} size="sm" variant="outline" onClick={() => replaceWord(s)}>
                  {s}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => replaceWord(draft)} disabled={!draft}>
                Change
              </Button>
              <Button size="sm" variant="outline" onClick={() => void spellSkip()}>
                Skip
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await addSpellWord("names", current.issue.word);
                  toast(`Added “${current.issue.word}” to names`);
                  await spellDropCurrentWord();
                }}
              >
                Add to names
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await addSpellWord("dictionary", current.issue.word);
                  toast(`Added “${current.issue.word}” to dictionary`);
                  await spellDropCurrentWord();
                }}
              >
                Add to dictionary
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.min(at + 1, hits.length)} of {hits.length}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {status === "checking"
              ? "Checking…"
              : !inTauri
                ? "Spell check needs the desktop app."
                : hits.length === 0
                  ? "No issues found."
                  : "Open spell check to start."}
          </p>
        )}

        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={async () => {
              await runSpellSession();
              if (!useSpellSession.getState().hits.length) toast("No spelling issues");
            }}
          >
            Recheck
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
