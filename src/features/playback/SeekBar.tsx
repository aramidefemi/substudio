import { useEffect, useRef } from "react";
import { selectTimeFormat, useSubtitles } from "@/features/subtitles/store";
import { formatTime } from "@/features/subtitles/timecode";
import { clock } from "./clock";

const SMALL_STEP = 1;
const LARGE_STEP = 5;

/**
 * Video scrub bar. Click or drag anywhere to seek; hovering shows the time
 * under the pointer. Painted from the clock outside React, like the other
 * per-frame readouts.
 */
export function SeekBar() {
  const barRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const pendingSeek = useRef<number | null>(null);

  useEffect(() => {
    const paint = () => {
      const bar = barRef.current;
      if (!bar) return;
      const d = clock.duration;
      const pct = `${d > 0 ? Math.min(100, (clock.time / d) * 100) : 0}%`;
      fillRef.current!.style.width = pct;
      thumbRef.current!.style.left = pct;
      bar.setAttribute("aria-valuemax", String(Math.round(d)));
      bar.setAttribute("aria-valuenow", String(Math.round(clock.time)));
      bar.setAttribute("aria-valuetext", formatTime(clock.time, selectTimeFormat(useSubtitles.getState())));
    };
    paint();
    const unsubs = [clock.onTick(paint), useSubtitles.subscribe(paint)];
    return () => unsubs.forEach((u) => u());
  }, []);

  const fractionAt = (clientX: number) => {
    const rect = barRef.current!.getBoundingClientRect();
    return rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0;
  };

  // Coalesce drag seeks to one per frame so scrubbing a long film stays smooth.
  const seekTo = (t: number) => {
    const first = pendingSeek.current === null;
    pendingSeek.current = t;
    if (!first) return;
    requestAnimationFrame(() => {
      if (pendingSeek.current !== null) clock.seek(pendingSeek.current);
      pendingSeek.current = null;
    });
  };

  const showHover = (clientX: number) => {
    const f = fractionAt(clientX);
    hoverRef.current!.style.left = `${f * 100}%`;
    tipRef.current!.textContent = formatTime(f * clock.duration, selectTimeFormat(useSubtitles.getState()));
  };

  return (
    <div
      ref={barRef}
      role="slider"
      tabIndex={0}
      aria-label="Video position"
      aria-valuemin={0}
      className="group relative h-3 shrink-0 cursor-pointer touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekTo(fractionAt(e.clientX) * clock.duration);
      }}
      onPointerMove={(e) => {
        showHover(e.clientX);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) seekTo(fractionAt(e.clientX) * clock.duration);
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? LARGE_STEP : SMALL_STEP;
        const moves: Record<string, number> = {
          ArrowLeft: clock.time - step,
          ArrowRight: clock.time + step,
          Home: 0,
          End: clock.duration,
        };
        const t = moves[e.key];
        if (t === undefined) return;
        e.preventDefault();
        e.stopPropagation();
        clock.seek(t);
      }}
    >
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-white/15 transition-[height] group-hover:h-1.5">
        <div ref={fillRef} className="h-full bg-primary" />
      </div>
      <div
        ref={thumbRef}
        className="pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      />
      <div ref={hoverRef} className="pointer-events-none absolute inset-y-0 hidden w-px bg-white/70 group-hover:block">
        <span
          ref={tipRef}
          className="absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 rounded bg-black/85 px-1.5 py-0.5 text-[11px] whitespace-nowrap text-white tabular-nums"
        />
      </div>
    </div>
  );
}
