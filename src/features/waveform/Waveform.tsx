import { useEffect, useRef, useState } from "react";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { clock } from "@/features/playback/clock";
import { onThemeChange } from "@/features/settings/appearance";
import { useSettings } from "@/features/settings/store";
import { getRules } from "@/features/subtitles/activeRules";
import { select, useSubtitles } from "@/features/subtitles/store";
import { WAVEFORM_ID } from "@/lib/dom";
import { menuTarget, setPointerTime, type MenuTarget } from "./context";
import { drawWaveform } from "./draw";
import { useMedia } from "@/features/media/store";
import { loadPeaks, usePeaks } from "./peaks";
import { attachPointer } from "./pointer";
import { createCueFromRegion, regionContains, useRegion } from "./region";
import { loadSpectrogram, useSpectrogram } from "./spectrogram";
import { WaveformMenu } from "./WaveformMenu";
import { canvasTokens, invalidateCanvasTokens } from "./tokens";
import { centerOn, resetZoom, scrollBy, setAmplitude, setZoom, useWaveView } from "./view";

function waveformMessage(
  display: "waveform" | "spectrogram",
  peaksStatus: string,
  peaksProgress: number,
  peaksError: string | null,
  specStatus: string,
  specProgress: number,
  specError: string | null,
  videoPath: string | null,
): string | null {
  if (!videoPath) return "Open a video to see its waveform";
  if (display === "spectrogram") {
    if (specStatus === "loading") return `Reading spectrogram… ${Math.round(specProgress * 100)}%`;
    if (specStatus === "error") return `Couldn't read the spectrogram: ${specError ?? "unknown error"}`;
    return null;
  }
  if (peaksStatus === "loading") return `Reading audio… ${Math.round(peaksProgress * 100)}%`;
  if (peaksStatus === "error") return `Couldn't read the audio: ${peaksError ?? "unknown error"}`;
  return null;
}

/**
 * Canvas timeline. Draws outside React: every source (clock, document, view,
 * theme, size) schedules at most one redraw per animation frame.
 */
export function Waveform() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [menu, setMenu] = useState<{ target: MenuTarget; hasRegion: boolean } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let frame = 0;

    const draw = () => {
      frame = 0;
      const dpr = window.devicePixelRatio || 1;
      const { clientWidth: w, clientHeight: h } = canvas;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { cues, selectedIds } = useSubtitles.getState();
      const { start, pps, amp, display } = useWaveView.getState();
      const hideText = useSettings.getState().privacy === "text";
      const peaks = usePeaks.getState();
      const spec = useSpectrogram.getState();
      drawWaveform(ctx, {
        width: w,
        height: h,
        start,
        pps,
        amp,
        time: clock.time,
        cues,
        selectedIds: new Set(selectedIds),
        hideText,
        peaks: peaks.peaks,
        spectrogram: spec.spectrogram,
        display,
        shotChanges: useMedia.getState().shotChanges,
        region: useRegion.getState().region,
        message: waveformMessage(
          display,
          peaks.status,
          peaks.progress,
          peaks.error,
          spec.status,
          spec.progress,
          spec.error,
          useSubtitles.getState().videoPath,
        ),
        tokens: canvasTokens(),
        rules: getRules(),
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };

    // Page the view forward when the playhead runs off the right edge.
    const follow = () => {
      const { start, pps } = useWaveView.getState();
      const span = canvas.clientWidth / pps;
      const t = clock.time;
      if (clock.playing && (t > start + span * 0.92 || t < start)) {
        useWaveView.setState({ start: Math.max(0, t - span * 0.08) });
      } else if (!clock.playing && (t > start + span || t < start)) {
        // A seek from elsewhere (seek bar, list) landed off-screen: centre on it.
        useWaveView.setState({ start: Math.max(0, t - span / 2) });
      }
      schedule();
    };

    const resize = new ResizeObserver(schedule);
    resize.observe(canvas);
    const unsubs = [
      clock.onTick(follow),
      useSubtitles.subscribe(schedule),
      useSettings.subscribe(schedule),
      useWaveView.subscribe(schedule),
      usePeaks.subscribe(schedule),
      useSpectrogram.subscribe(schedule),
      useMedia.subscribe(schedule),
      useRegion.subscribe(schedule),
      onThemeChange(() => {
        invalidateCanvasTokens();
        schedule();
      }),
    ];
    const detachPointer = attachPointer(canvas);
    schedule();
    return () => {
      detachPointer();
      unsubs.forEach((u) => u());
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  // Decode (or fetch the cached) waveform whenever the video or audio track changes.
  useEffect(() => {
    const reload = () => {
      const path = useSubtitles.getState().videoPath;
      const track = useMedia.getState().audioTrack;
      void loadPeaks(path, track);
      if (useWaveView.getState().display === "spectrogram") {
        void loadSpectrogram(path, track);
      }
    };
    reload();
    const unsubs = [
      useSubtitles.subscribe((s, prev) => {
        if (s.videoPath !== prev.videoPath) reload();
      }),
      useMedia.subscribe((s, prev) => {
        if (s.audioTrack !== prev.audioTrack) reload();
      }),
      useWaveView.subscribe((s, prev) => {
        if (s.display === "spectrogram" && s.display !== prev.display) {
          void loadSpectrogram(useSubtitles.getState().videoPath, useMedia.getState().audioTrack);
        }
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const timeAt = (clientX: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const { start, pps } = useWaveView.getState();
    return start + (clientX - rect.left) / pps;
  };

  return (
    <div className="h-full overflow-hidden rounded-xl bg-timeline">
      <ContextMenu
        onOpenChange={(open) => {
          if (!open) setPointerTime(null);
        }}
      >
        <ContextMenuTrigger asChild>
          <canvas
            ref={canvasRef}
            id={WAVEFORM_ID}
            tabIndex={0}
            onContextMenu={(e) => {
              // Runs before the menu opens: aim the position-aware commands here.
              const t = Math.max(0, timeAt(e.clientX));
              const s = useSubtitles.getState();
              const target = menuTarget(s.cues, t);
              if (target.cueId && target.cueId !== s.selectedId) select(target.cueId);
              setPointerTime(t);
              setMenu({ target, hasRegion: !!useRegion.getState().region });
            }}
            aria-label="Waveform timeline. Click to seek; ⇧-click sets the selected subtitle's start, ⌘-click its end. Drag a subtitle's edges to retime it, its middle to move it (⌥-drag an edge moves the neighbour too). Drag on empty space to mark a region; Enter or double-click inside it creates a subtitle, Escape clears it. Scroll to pan, ⌘-scroll to zoom time, ⌥-scroll to zoom amplitude. Double-click to centre; ⌥-double-click to reset zoom. Right-click for paste into region, insert, split, guess times, seek silence, toggle shot change, merge and delete. Toggle spectrogram from the transport bar or Waveform menu."
            className="block size-full cursor-text touch-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
            onDoubleClick={(e) => {
              const w = e.currentTarget.clientWidth;
              if (!e.altKey && regionContains(useRegion.getState().region, timeAt(e.clientX))) {
                createCueFromRegion();
                return;
              }
              if (e.altKey) {
                resetZoom({ centerTime: clock.time, widthPx: w });
                return;
              }
              centerOn(timeAt(e.clientX), w);
            }}
            onWheel={(e) => {
              // ⌥+wheel: amplitude / spectrogram contrast; ⌘/Ctrl+wheel: time zoom; else pan.
              if (e.altKey) {
                e.preventDefault();
                setAmplitude(useWaveView.getState().amp * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
              } else if (e.ctrlKey || e.metaKey) {
                const rect = e.currentTarget.getBoundingClientRect();
                setZoom(useWaveView.getState().pps * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - rect.left);
              } else {
                const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
                scrollBy(d / useWaveView.getState().pps);
              }
            }}
          />
        </ContextMenuTrigger>
        <WaveformMenu target={menu?.target ?? null} hasRegion={menu?.hasRegion ?? false} />
      </ContextMenu>
    </div>
  );
}
