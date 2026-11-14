import { useState } from "react";
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
import { clock } from "@/features/playback/clock";
import { parseLineNumber } from "@/features/subtitles/navigation";
import { select, selectSelectedIndex, useSubtitles } from "@/features/subtitles/store";
import { closeGoToLine as close, useGoToLine } from "./goToLine";

function GoToLineForm() {
  const count = useSubtitles((s) => s.cues.length);
  const [value, setValue] = useState(() => String(selectSelectedIndex(useSubtitles.getState()) + 1 || ""));
  const index = parseLineNumber(value, count);
  const go = () => {
    if (index === null) return;
    const cue = useSubtitles.getState().cues[index]!;
    select(cue.id);
    clock.seek(cue.start);
    close();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Go to line</DialogTitle>
        <DialogDescription>{count ? `Line number, 1 to ${count}.` : "There are no lines yet."}</DialogDescription>
      </DialogHeader>
      <Input
        autoFocus
        aria-label="Line number"
        inputMode="numeric"
        className="tabular-nums"
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            go();
          }
        }}
      />
      <DialogFooter>
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button onClick={go} disabled={index === null}>
          Go
        </Button>
      </DialogFooter>
    </>
  );
}

/** ⌘L: jump to a line by its number. */
export function GoToLineDialog() {
  const open = useGoToLine((s) => s.open);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-xs">{open && <GoToLineForm />}</DialogContent>
    </Dialog>
  );
}
