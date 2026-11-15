import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import {
  beautifyCues,
  countBeautifyChanges,
  DEFAULT_BEAUTIFY,
  type BeautifyOptions,
} from "@/features/subtitles/beautify";
import { applyCueData } from "@/features/subtitles/qualityApply";
import { useSubtitles } from "@/features/subtitles/store";
import { useUi } from "./actions";

function Opt({
  label,
  pressed,
  onChange,
}: {
  label: string;
  pressed: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Toggle size="sm" variant="outline" pressed={pressed} onPressedChange={onChange} className="h-7 px-2 text-xs">
      {label}
    </Toggle>
  );
}

/** Tools → Beautify time codes (QLT-02). */
export function BeautifyDialog() {
  const open = useUi((s) => s.beautifyOpen);
  const cues = useSubtitles((s) => s.cues);
  const fps = useSubtitles((s) => s.fps);
  const [opts, setOpts] = useState<BeautifyOptions>(() => ({ ...DEFAULT_BEAUTIFY, fps }));

  const next = useMemo(() => beautifyCues(cues, { ...opts, fps: opts.fps || fps }), [cues, opts, fps]);
  const changes = useMemo(() => countBeautifyChanges(cues, next), [cues, next]);

  const patch = (p: Partial<BeautifyOptions>) => setOpts((o) => ({ ...o, ...p }));

  return (
    <Dialog open={open} onOpenChange={(v) => useUi.setState({ beautifyOpen: v })}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Beautify time codes</DialogTitle>
          <DialogDescription>Snap to frames, bridge gaps, and apply duration limits.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Opt label="Snap to frames" pressed={opts.snapToFrames} onChange={(v) => patch({ snapToFrames: v })} />
          <Opt label="Min gap" pressed={opts.applyMinGap} onChange={(v) => patch({ applyMinGap: v })} />
          <Opt
            label="Duration limits"
            pressed={opts.applyDurationLimits}
            onChange={(v) => patch({ applyDurationLimits: v })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Bridge gaps under (s)</span>
            <Input
              className="h-8"
              type="number"
              step="0.05"
              min="0"
              value={opts.bridgeGapsUnder ?? 0}
              onChange={(e) => {
                const n = Number(e.target.value);
                patch({ bridgeGapsUnder: n > 0 ? n : null });
              }}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">FPS</span>
            <Input
              className="h-8"
              type="number"
              step="0.001"
              min="1"
              value={opts.fps}
              onChange={(e) => patch({ fps: Number(e.target.value) || fps })}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Min duration (s)</span>
            <Input
              className="h-8"
              type="number"
              step="0.1"
              value={opts.minDuration}
              onChange={(e) => patch({ minDuration: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Max duration (s)</span>
            <Input
              className="h-8"
              type="number"
              step="0.1"
              value={opts.maxDuration}
              onChange={(e) => patch({ maxDuration: Number(e.target.value) || 0 })}
            />
          </label>
        </div>

        <p className="text-xs text-muted-foreground">{changes} line{changes === 1 ? "" : "s"} would change</p>

        <div className="flex justify-end">
          <Button
            disabled={!changes}
            onClick={() => {
              applyCueData(next, "beautify");
              toast(`Beautified ${changes} line${changes === 1 ? "" : "s"}`);
              useUi.setState({ beautifyOpen: false });
            }}
          >
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
