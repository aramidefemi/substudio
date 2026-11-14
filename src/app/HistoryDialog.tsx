import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listHistorySteps, restoreHistoryTo, useSubtitles } from "@/features/subtitles/store";
import { useUi } from "./actions";

/** Edit → Show History: browse undo stack and restore an earlier state. */
export function HistoryDialog() {
  const open = useUi((s) => s.historyOpen);
  const pastLen = useSubtitles((s) => s.past.length);
  const steps = open ? listHistorySteps() : [];
  const setOpen = (historyOpen: boolean) => useUi.setState({ historyOpen });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>History</DialogTitle>
          <DialogDescription>
            {pastLen ? `${pastLen} undo step${pastLen === 1 ? "" : "s"}` : "No undo history yet."}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto rounded-md border border-border">
          {!pastLen && <p className="p-3 text-sm text-muted-foreground">Make an edit to populate history.</p>}
          <ul className="divide-y divide-border">
            {[...steps].reverse().map((step, i) => {
              const newest = i === 0;
              return (
                <li key={`${step.index}-${step.label}`} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{step.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {newest ? "Latest" : `${i} step${i === 1 ? "" : "s"} ago`}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={newest}
                    onClick={() => {
                      // Keep this step and everything older; undo newer ones.
                      restoreHistoryTo(step.index + 1);
                      setOpen(false);
                    }}
                  >
                    {newest ? "Current" : "Restore"}
                  </Button>
                </li>
              );
            })}
          </ul>
          {pastLen > 0 && (
            <div className="border-t border-border px-3 py-2">
              <Button
                size="sm"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  restoreHistoryTo(0);
                  setOpen(false);
                }}
              >
                Restore to original (before all undos)
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
