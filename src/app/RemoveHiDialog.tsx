import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Toggle } from "@/components/ui/toggle";
import { applyCueData } from "@/features/subtitles/qualityApply";
import {
  DEFAULT_REMOVE_HI,
  removeHearingImpaired,
  type RemoveHiOptions,
} from "@/features/subtitles/removeHi";
import { useSubtitles } from "@/features/subtitles/store";
import { useUi } from "./actions";

/** Tools → Remove text for hearing impaired (QLT-06). */
export function RemoveHiDialog() {
  const open = useUi((s) => s.removeHiOpen);
  const cues = useSubtitles((s) => s.cues);
  const [opts, setOpts] = useState<RemoveHiOptions>(DEFAULT_REMOVE_HI);
  const next = useMemo(() => removeHearingImpaired(cues, opts), [cues, opts]);
  const changed = next.length !== cues.length || next.some((c, i) => c.text !== cues[i]?.text);

  const toggle = (key: keyof RemoveHiOptions) =>
    setOpts((o) => ({ ...o, [key]: !o[key] }));

  return (
    <Dialog open={open} onOpenChange={(v) => useUi.setState({ removeHiOpen: v })}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove text for hearing impaired</DialogTitle>
          <DialogDescription>Strip SFX brackets, music notes, and speaker labels.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["brackets", "Brackets [ ]"],
              ["parentheses", "Parentheses ( )"],
              ["music", "Music notes"],
              ["speakerColon", "Speaker labels"],
              ["dropEmpty", "Drop empty cues"],
            ] as const
          ).map(([key, label]) => (
            <Toggle
              key={key}
              size="sm"
              variant="outline"
              pressed={opts[key]}
              onPressedChange={() => toggle(key)}
              className="h-7 px-2 text-xs"
            >
              {label}
            </Toggle>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {cues.length - next.length} removed · {next.filter((c, i) => c.text !== cues[i]?.text).length} edited
        </p>
        <div className="flex justify-end">
          <Button
            disabled={!changed}
            onClick={() => {
              applyCueData(next, "remove-hi");
              toast("Removed hearing-impaired text");
              useUi.setState({ removeHiOpen: false });
            }}
          >
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
