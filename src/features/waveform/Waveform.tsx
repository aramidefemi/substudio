import { useEffect, useRef } from "react";
import { clock } from "@/features/playback/clock";
import { onThemeChange } from "@/features/settings/appearance";
import { useSettings } from "@/features/settings/store";
import { select, useSubtitles } from "@/features/subtitles/store";
import { drawWaveform } from "./draw";
import { canvasTokens, invalidateCanvasTokens } from "./tokens";
import { centerOn, resetZoom, scrollBy, setAmplitude, setZoom, useWaveView } from "./view";

/**
 * Canvas timeline. Draws outside React: every source (clock, document, view,
 * theme, size) schedules at most one redraw per animation frame.
 */
export function Waveform() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      const { start, pps, amp } = useWaveView.getState();
      const hideText = useSettings.getState().privacy === "text";
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
        tokens: canvasTokens(),
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
      onThemeChange(() => {
        invalidateCanvasTokens();
        schedule();
      }),
    ];
    schedule();
    return () => {
      unsubs.forEach((u) => u());
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const timeAt = (clientX: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const { start, pps } = useWaveView.getState();
    return start + (clientX - rect.left) / pps;
  };

  return (
    <div className="h-full overflow-hidden rounded-xl bg-timeline">
      <canvas
        ref={canvasRef}
        aria-label="Waveform timeline. Scroll to pan, ⌘-scroll to zoom time, ⌥-scroll to zoom amplitude. Double-click to centre; ⌥-double-click to reset zoom."
        className="block size-full cursor-text"
        onPointerDown={(e) => {
          const t = timeAt(e.clientX);
          const hit = useSubtitles.getState().cues.find((c) => t >= c.start && t <= c.end);
          if (hit) select(hit.id);
          clock.seek(t);
        }}
        onDoubleClick={(e) => {
          const w = e.currentTarget.clientWidth;
          if (e.altKey) {
            resetZoom({ centerTime: clock.time, widthPx: w });
            return;
          }
          centerOn(timeAt(e.clientX), w);
        }}
        onWheel={(e) => {
          // ⌥+wheel: amplitude; ⌘/Ctrl+wheel: time zoom; else pan.
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
    </div>
  );
}
