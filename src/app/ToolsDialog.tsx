import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  changeCasingCues,
  mergeSameText,
  mergeSameTime,
  mergeShortLines,
  type CasingMode,
} from "@/features/subtitles/casing";
import { applyCueData } from "@/features/subtitles/qualityApply";
import { useSubtitles } from "@/features/subtitles/store";
import { useUi } from "./actions";

const CASING: { mode: CasingMode; label: string }[] = [
  { mode: "lower", label: "lowercase" },
  { mode: "upper", label: "UPPERCASE" },
  { mode: "sentence", label: "Sentence case" },
  { mode: "proper", label: "Proper Case" },
];

/** Tools → Change casing / merge helpers (QLT-05). */
export function ToolsDialog() {
  const open = useUi((s) => s.toolsOpen);
  const cues = useSubtitles((s) => s.cues);
  const [mode, setMode] = useState<CasingMode>("sentence");

  return (
    <Dialog open={open} onOpenChange={(v) => useUi.setState({ toolsOpen: v })}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Text tools</DialogTitle>
          <DialogDescription>Change casing and merge short / duplicate lines.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Change casing</p>
          <div className="flex flex-wrap gap-2">
            {CASING.map((c) => (
              <Button
                key={c.mode}
                size="sm"
                variant={mode === c.mode ? "default" : "outline"}
                onClick={() => setMode(c.mode)}
              >
                {c.label}
              </Button>
            ))}
          </div>
          <Button
            className="w-full"
            onClick={() => {
              applyCueData(changeCasingCues(cues, mode), "casing");
              toast(`Applied ${mode} casing`);
              useUi.setState({ toolsOpen: false });
            }}
          >
            Apply casing
          </Button>
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground">Merge</p>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const next = mergeShortLines(cues);
                applyCueData(next, "merge-short");
                toast(`Merged short lines (${cues.length} → ${next.length})`);
                useUi.setState({ toolsOpen: false });
              }}
            >
              Merge short lines
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const next = mergeSameText(cues);
                applyCueData(next, "merge-same-text");
                toast(`Merged same text (${cues.length} → ${next.length})`);
                useUi.setState({ toolsOpen: false });
              }}
            >
              Merge same text
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const next = mergeSameTime(cues);
                applyCueData(next, "merge-same-time");
                toast(`Merged same time (${cues.length} → ${next.length})`);
                useUi.setState({ toolsOpen: false });
              }}
            >
              Merge same time codes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
