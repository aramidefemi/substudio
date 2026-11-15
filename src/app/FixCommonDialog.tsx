import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Toggle } from "@/components/ui/toggle";
import { applyCueData } from "@/features/subtitles/qualityApply";
import {
  FIX_DEFS,
  defaultFixIds,
  fixCommonErrors,
  hitsByFix,
  type FixId,
} from "@/features/subtitles/fixCommon";
import { useSubtitles } from "@/features/subtitles/store";
import { useUi } from "./actions";

/** Tools → Fix common errors: pick fixes, preview counts, apply (QLT-01). */
export function FixCommonDialog() {
  const open = useUi((s) => s.fixCommonOpen);
  const cues = useSubtitles((s) => s.cues);
  const [step, setStep] = useState<1 | 2>(1);
  const [ids, setIds] = useState<FixId[]>(() => defaultFixIds());

  const result = useMemo(() => fixCommonErrors(cues, ids), [cues, ids]);
  const counts = useMemo(() => hitsByFix(result.hits), [result.hits]);

  const setOpen = (v: boolean) => {
    useUi.setState({ fixCommonOpen: v });
    if (!v) setStep(1);
  };

  const toggle = (id: FixId) =>
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const apply = () => {
    applyCueData(result.cues, "fix-common");
    toast(`Fixed ${result.hits.length} issue${result.hits.length === 1 ? "" : "s"}`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fix common errors</DialogTitle>
          <DialogDescription>
            {step === 1 ? "Choose which fixes to run." : `Preview · ${result.hits.length} changes`}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="min-h-0 flex-1 space-y-2 overflow-auto">
            {FIX_DEFS.map((f) => (
              <label key={f.id} className="flex items-start gap-3 rounded-md border border-border px-3 py-2">
                <Toggle
                  size="sm"
                  variant="outline"
                  pressed={ids.includes(f.id)}
                  onPressedChange={() => toggle(f.id)}
                  className="mt-0.5 h-7 shrink-0 px-2 text-xs"
                >
                  {ids.includes(f.id) ? "On" : "Off"}
                </Toggle>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{f.label}</span>
                  <span className="text-xs text-muted-foreground">{f.description}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-2 overflow-auto text-sm">
            {FIX_DEFS.filter((f) => ids.includes(f.id)).map((f) => (
              <div key={f.id} className="flex justify-between gap-3">
                <span>{f.label}</span>
                <span className="tabular-nums text-muted-foreground">{counts[f.id]}</span>
              </div>
            ))}
            {result.hits.length === 0 && (
              <p className="text-muted-foreground">Nothing to fix with the current selection.</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
          )}
          {step === 1 ? (
            <Button onClick={() => setStep(2)} disabled={!ids.length}>
              Preview
            </Button>
          ) : (
            <Button onClick={apply} disabled={!result.hits.length}>
              Apply
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
