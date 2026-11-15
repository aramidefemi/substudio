import { convertFileSrc } from "@tauri-apps/api/core";
import { Maximize, Pause, Play, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { openVideo } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useMedia } from "@/features/media/store";
import { previewLayout } from "@/features/settings/preview";
import { useSettings } from "@/features/settings/store";
import { cn } from "@/lib/utils";
import { formatRuns } from "@/features/subtitles/format";
import { cueIndexAt, selectTimeFormat, useSubtitles } from "@/features/subtitles/store";
import { formatTime } from "@/features/subtitles/timecode";
import { clock, usePlaying } from "./clock";
import { SeekBar } from "./SeekBar";

function paintCueOverlay(el: HTMLElement, text: string) {
  el.replaceChildren();
  const lines = text.split("\n");
  lines.forEach((line, li) => {
    if (li > 0) el.append(document.createElement("br"));
    for (const run of formatRuns(line)) {
      const span = document.createElement("span");
      span.textContent = run.text;
      if (run.italic) span.style.fontStyle = "italic";
      if (run.bold) span.style.fontWeight = "700";
      el.append(span);
    }
  });
}

export function VideoPanel() {
  const videoPath = useSubtitles((s) => s.videoPath);
  /** Source path stays on the document; `<video>` may use a MED-02 editing proxy. */
  const playbackPath = useMedia((s) => s.playbackPath);
  const proxyProgress = useMedia((s) => s.proxyProgress);
  const srcPath = playbackPath;
  const playing = usePlaying();
  const preview = previewLayout(useSettings((s) => s.preview));
  const [volume, setVolume] = useState(0.8);
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    clock.attach(srcPath ? videoRef.current : null);
    return () => clock.attach(null);
  }, [srcPath]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume, srcPath]);

  // Per-frame readouts are written straight to the DOM, not through React state.
  useEffect(() => {
    const paint = () => {
      const s = useSubtitles.getState();
      const t = clock.time;
      const cue = s.cues[cueIndexAt(s.cues, t)];
      const hideText = useSettings.getState().privacy === "text";
      if (overlayRef.current) {
        const text = hideText ? (cue?.text ? "••••" : "") : (cue?.text ?? "");
        if (!text) {
          overlayRef.current.replaceChildren();
          overlayRef.current.hidden = true;
        } else {
          paintCueOverlay(overlayRef.current, text);
          overlayRef.current.hidden = false;
        }
      }
      const fmt = selectTimeFormat(s);
      if (timeRef.current) timeRef.current.textContent = `${formatTime(t, fmt)} / ${formatTime(clock.duration, fmt)}`;
    };
    paint();
    const unsubs = [clock.onTick(paint), useSubtitles.subscribe(paint), useSettings.subscribe(paint)];
    return () => unsubs.forEach((u) => u());
  }, []);

  return (
    <div ref={boxRef} className="flex h-full flex-col overflow-hidden rounded-xl bg-video">
      <div className="relative min-h-0 flex-1 [container-type:size]">
        {videoPath && srcPath ? (
          <video
            key={srcPath}
            ref={videoRef}
            src={convertFileSrc(srcPath)}
            playsInline
            className="absolute inset-0 size-full object-contain"
          />
        ) : videoPath ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/70">
            <span>{proxyProgress != null ? "Creating editing proxy…" : "Preparing playback…"}</span>
            {proxyProgress != null && (
              <span className="tabular-nums text-white/50">{Math.round(proxyProgress * 100)}%</span>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void openVideo()}
            className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3 text-white/60 transition-colors hover:text-white/80"
          >
            <span className="flex size-20 items-center justify-center rounded-full border-2 border-current">
              <Play className="ml-1 size-8" />
            </span>
            <span className="text-sm">Open a video</span>
          </button>
        )}
        {/* Preview style (PLY-06): size follows the video height via cqh; box or outline; vertical anchor. */}
        <div
          className="pointer-events-none absolute inset-x-0 flex justify-center px-[6%]"
          style={preview.anchor === "top" ? { top: preview.margin } : { bottom: preview.margin }}
        >
          <span
            ref={overlayRef}
            style={{ fontSize: preview.fontSize }}
            className={cn(
              "rounded-md px-[0.5em] py-[0.15em] text-center leading-snug font-semibold whitespace-pre-line text-(--preview-text)",
              preview.box ? "bg-(--preview-box)" : "preview-outline",
            )}
          />
        </div>
      </div>

      <SeekBar />
      <div className="flex items-center gap-2 px-3 pt-1 pb-2 text-white">
        <Button size="icon-sm" variant="ghost" aria-label={playing ? "Pause" : "Play"} onClick={() => clock.toggle()} className="text-white hover:bg-white/10 hover:text-white">
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Stop"
          onClick={() => {
            clock.pause();
            clock.seek(0);
          }}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <Square />
        </Button>
        <span ref={timeRef} className="ml-1 text-xs tabular-nums text-white/80" />
        <div className="flex-1" />
        <Volume2 className="size-4 text-white/80" aria-hidden />
        <Slider aria-label="Volume" className="w-24" min={0} max={1} step={0.01} value={[volume]} onValueChange={([v]) => setVolume(v ?? 0)} />
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Full screen"
          onClick={() => void boxRef.current?.requestFullscreen()}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <Maximize />
        </Button>
      </div>
    </div>
  );
}
