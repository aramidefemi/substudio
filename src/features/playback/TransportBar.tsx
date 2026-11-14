import { Minus, Pause, Play, Plus, Repeat, SkipBack, SquarePlay, StepBack, StepForward } from "lucide-react";
import { addCueAtPlayhead } from "@/app/actions";
import { commandTitle } from "@/app/commands/registry";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { selectRelative, selectSelectedIndex, toggleTimecode, useSubtitles } from "@/features/subtitles/store";
import { DEFAULT_PPS, MAX_PPS, MIN_PPS, setZoom, useWaveView } from "@/features/waveform/view";
import { clock, useLooping, usePlaybackRate, usePlaying } from "./clock";
import { playSelection, SPEEDS, toggleLoopSelection } from "./transport";


interface IconButtonProps {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}

function IconButton({ label, onClick, pressed, children }: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant={pressed ? "secondary" : "outline"}
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function TransportBar() {
  const playing = usePlaying();
  const rate = usePlaybackRate();
  const looping = useLooping();
  const pps = useWaveView((s) => s.pps);
  const index = useSubtitles(selectSelectedIndex);
  const count = useSubtitles((s) => s.cues.length);
  const timecode = useSubtitles((s) => s.timecode);
  const fps = useSubtitles((s) => s.fps);

  const seekToCue = (delta: number) => {
    selectRelative(delta);
    const s = useSubtitles.getState();
    const cue = s.cues[selectSelectedIndex(s)];
    if (cue) clock.seek(cue.start);
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-t bg-background px-3 py-2">
      <IconButton label="Go to start" onClick={() => clock.seek(0)}>
        <SkipBack />
      </IconButton>
      <IconButton label="Previous subtitle (↑)" onClick={() => seekToCue(-1)}>
        <StepBack />
      </IconButton>
      <Button size="icon" aria-label={playing ? "Pause (Space)" : "Play (Space)"} onClick={() => clock.toggle()} className="w-12">
        {playing ? <Pause /> : <Play />}
      </Button>
      <IconButton label="Next subtitle (↓)" onClick={() => seekToCue(1)}>
        <StepForward />
      </IconButton>
      <IconButton label={commandTitle("playback.playSelection")} onClick={() => playSelection()}>
        <SquarePlay />
      </IconButton>
      <IconButton label={commandTitle("playback.loopSelection")} onClick={toggleLoopSelection} pressed={looping}>
        <Repeat />
      </IconButton>
      <IconButton label="Add subtitle at playhead" onClick={addCueAtPlayhead}>
        <Plus />
      </IconButton>

      <Separator orientation="vertical" className="mx-2 h-6" />

      <IconButton label="Zoom out" onClick={() => setZoom(pps / 1.25)}>
        <Minus />
      </IconButton>
      <Slider
        aria-label="Zoom"
        className="w-32"
        min={Math.log(MIN_PPS)}
        max={Math.log(MAX_PPS)}
        step={0.01}
        value={[Math.log(pps)]}
        onValueChange={([v]) => setZoom(Math.exp(v ?? Math.log(DEFAULT_PPS)))}
      />
      <IconButton label="Zoom in" onClick={() => setZoom(pps * 1.25)}>
        <Plus />
      </IconButton>
      <span className="w-12 text-xs tabular-nums text-muted-foreground">{Math.round((pps / DEFAULT_PPS) * 100)}%</span>

      <Separator orientation="vertical" className="mx-2 h-6" />

      <Select value={String(rate)} onValueChange={(v) => clock.setRate(Number(v))}>
        <SelectTrigger aria-label="Playback speed" size="sm" className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SPEEDS.map(String).map((s) => (
            <SelectItem key={s} value={s}>
              Speed {s}x
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex-1" />

      <Button variant="ghost" size="sm" onClick={toggleTimecode} className="text-xs text-muted-foreground tabular-nums">
        {timecode === "frames" ? `hh:mm:ss:ff · ${fps} fps` : "hh:mm:ss,mmm"}
      </Button>
      <span className="rounded-md border bg-card px-3 py-1.5 text-sm font-medium tabular-nums">
        {count ? index + 1 : 0} / {count}
      </span>
    </div>
  );
}
