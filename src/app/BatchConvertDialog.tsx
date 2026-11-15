import { useState } from "react";
import { Channel } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BATCH_FORMATS,
  type BatchFailure,
  type BatchProgress,
  batchSummary,
  convertedName,
  defaultOutDir,
  mergePaths,
  parseOffsetMs,
} from "@/features/export/batch";
import { percent } from "@/features/export/burn";
import type { SubtitleFormat } from "@/features/subtitles/types";
import { commands, fileName, inTauri } from "@/lib/tauri";
import { SUBTITLE_EXTENSIONS } from "./drop";
import { useUi } from "./actions";

const PREVIEW_ROWS = 4;

/** File › Batch convert: many subtitle files → one format in an output folder (DLV-03). */
export function BatchConvertDialog() {
  const isOpen = useUi((s) => s.batchConvertOpen);
  const [paths, setPaths] = useState<string[]>([]);
  const [outDir, setOutDir] = useState("");
  const [format, setFormat] = useState<SubtitleFormat>("srt");
  const [offsetText, setOffsetText] = useState("");
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [failed, setFailed] = useState<BatchFailure[]>([]);

  const running = progress !== null;
  const offset = parseOffsetMs(offsetText);
  const ready = paths.length > 0 && outDir.trim() !== "" && offset !== null && !running;

  const addPaths = (added: string[]) => {
    const next = mergePaths(paths, added);
    setPaths(next);
    if (!outDir) setOutDir(defaultOutDir(next));
    setFailed([]);
  };

  const addFiles = async () => {
    const picked = await open({
      multiple: true,
      title: "Choose subtitle files",
      filters: [{ name: "Subtitles", extensions: SUBTITLE_EXTENSIONS }],
    });
    if (picked) addPaths(picked);
  };

  const addFolder = async () => {
    const dir = await open({ directory: true, title: "Choose a folder of subtitles" });
    if (!dir) return;
    try {
      const found = await commands.listSubtitleFiles(dir);
      if (found.length) addPaths(found);
      else toast("No subtitle files in that folder", { description: fileName(dir) });
    } catch (err) {
      toast.error("Could not read folder", { description: String(err) });
    }
  };

  const pickOutDir = async () => {
    const dir = await open({ directory: true, title: "Choose the output folder" });
    if (dir) setOutDir(dir);
  };

  const convert = async () => {
    if (!inTauri) {
      toast("Batch convert in the desktop app", { description: "Run `pnpm tauri dev`." });
      return;
    }
    const channel = new Channel<BatchProgress>();
    channel.onmessage = setProgress;
    setProgress({ done: 0, total: paths.length, name: "" });
    setFailed([]);
    try {
      const outcome = await commands.batchConvert(paths, format, outDir, offset ?? 0, channel);
      const title = batchSummary(outcome);
      const reveal = outcome.ok[0];
      const action = reveal ? { label: "Show", onClick: () => void commands.revealPath(reveal) } : undefined;
      if (outcome.failed.length) {
        setFailed(outcome.failed);
        toast.warning(title, { description: "See the list in the dialog.", action });
      } else {
        toast.success(title, { description: fileName(outDir), action });
        useUi.setState({ batchConvertOpen: false });
        setPaths([]);
      }
    } catch (err) {
      toast.error("Batch convert failed", { description: String(err) });
    } finally {
      setProgress(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !running && useUi.setState({ batchConvertOpen: v })}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Batch convert</DialogTitle>
          <DialogDescription>
            Convert subtitle files to another format. Originals are never changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void addFiles()} disabled={running}>
              Add files…
            </Button>
            <Button size="sm" variant="outline" onClick={() => void addFolder()} disabled={running}>
              Add folder…
            </Button>
            {paths.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setPaths([])} disabled={running}>
                Clear
              </Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {paths.length} file{paths.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="min-h-5 space-y-0.5 text-xs text-muted-foreground">
            {paths.slice(0, PREVIEW_ROWS).map((p) => (
              <li key={p} className="truncate">
                {fileName(p)} → {convertedName(p, format)}
              </li>
            ))}
            {paths.length > PREVIEW_ROWS && <li>…and {paths.length - PREVIEW_ROWS} more</li>}
          </ul>
        </div>

        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            Convert to
            <Select value={format} onValueChange={(v) => setFormat(v as SubtitleFormat)} disabled={running}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BATCH_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Shift (ms)
            <Input
              className="h-8"
              inputMode="numeric"
              placeholder="0"
              value={offsetText}
              aria-invalid={offset === null}
              disabled={running}
              onChange={(e) => setOffsetText(e.target.value)}
            />
          </label>
        </div>

        <label className="space-y-1 text-xs text-muted-foreground">
          Output folder
          <div className="flex gap-2">
            <Input
              className="h-8"
              value={outDir}
              disabled={running}
              placeholder="Choose where converted files go"
              onChange={(e) => setOutDir(e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={() => void pickOutDir()} disabled={running}>
              Browse…
            </Button>
          </div>
        </label>

        {running && (
          <div className="space-y-1" role="status" aria-live="polite">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: percent(progress.done / progress.total) }}
              />
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {progress.done} of {progress.total}
              {progress.name && ` · ${progress.name}`}
            </p>
          </div>
        )}

        {failed.length > 0 && (
          <ul className="max-h-28 space-y-0.5 overflow-y-auto text-xs text-destructive">
            {failed.map((f) => (
              <li key={f.path}>
                {fileName(f.path)}: {f.error}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => useUi.setState({ batchConvertOpen: false })} disabled={running}>
            Close
          </Button>
          <Button onClick={() => void convert()} disabled={!ready}>
            Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
