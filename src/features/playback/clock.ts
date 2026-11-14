import { useSyncExternalStore } from "react";

type Listener = () => void;

/** Older WebKit only knows the prefixed flag. */
type PitchVideo = HTMLVideoElement & { webkitPreservesPitch?: boolean };

/** Apply a playback rate without the chipmunk effect: keep the voice's pitch at any speed. */
export function applyRate(video: PitchVideo, rate: number) {
  video.preservesPitch = true;
  video.webkitPreservesPitch = true;
  // A new src resets playbackRate to the default, so set both.
  video.defaultPlaybackRate = rate;
  video.playbackRate = rate;
}

/** A bounded stretch of playback: stops (or loops) when the playhead reaches `end`. */
export interface PlayRange {
  start: number;
  end: number;
  loop: boolean;
}

/**
 * The single source of playback time. Lives outside React: per-frame consumers
 * (waveform, video overlay, timecode readouts) subscribe with `onTick` and
 * write to the canvas/DOM directly. Without a video it runs a simulated clock.
 */
export class PlaybackClock {
  playing = false;
  rate = 1;
  /** Active play range (play line / loop line); cleared by pause, seek and plain play. */
  range: PlayRange | null = null;
  private video: HTMLVideoElement | null = null;
  private simTime = 0;
  private simEnd = 30;
  private lastTs = 0;
  private raf = 0;
  private tickListeners = new Set<Listener>();
  private stateListeners = new Set<Listener>();

  get time(): number {
    return this.video ? this.video.currentTime : this.simTime;
  }

  get duration(): number {
    const d = this.video?.duration;
    return d && Number.isFinite(d) ? d : this.simEnd;
  }

  /** Length of the simulated timeline when no video is loaded. */
  setFallbackDuration(seconds: number) {
    this.simEnd = Math.max(30, seconds);
  }

  attach(video: HTMLVideoElement | null) {
    this.pause();
    this.video = video;
    if (video) {
      applyRate(video, this.rate);
      video.onended = () => this.pause();
      video.onseeked = () => this.emitTick();
      video.onloadedmetadata = () => this.emitTick();
    }
    this.emitTick();
  }

  get looping(): boolean {
    return this.range?.loop ?? false;
  }

  /** Plain playback from the playhead (drops any play range). */
  play() {
    this.clearRange();
    this.start();
  }

  /** Play `start`→`end`, then stop at `end` (or jump back to `start` when `loop`). */
  playRange(start: number, end: number, loop = false) {
    if (!(end > start)) return;
    this.range = { start, end, loop };
    this.seekRaw(start);
    this.start();
    this.emitState();
  }

  /** Seek to `t` (clamped at 0) and play on from there. */
  playFrom(t: number) {
    this.seek(t);
    this.play();
  }

  pause() {
    this.clearRange();
    if (!this.playing) return;
    this.playing = false;
    this.video?.pause();
    cancelAnimationFrame(this.raf);
    this.emitState();
    this.emitTick();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(t: number) {
    this.clearRange();
    this.seekRaw(t);
  }

  setRate(rate: number) {
    this.rate = rate;
    if (this.video) applyRate(this.video, rate);
    this.emitState();
  }

  onTick(fn: Listener) {
    this.tickListeners.add(fn);
    return () => void this.tickListeners.delete(fn);
  }

  onState = (fn: Listener) => {
    this.stateListeners.add(fn);
    return () => void this.stateListeners.delete(fn);
  };

  private start() {
    if (this.playing) return;
    if (!this.video && this.simTime >= this.simEnd) this.simTime = 0;
    this.playing = true;
    this.video?.play().catch(() => this.pause());
    this.lastTs = 0;
    this.raf = requestAnimationFrame(this.loop);
    this.emitState();
  }

  private seekRaw(t: number) {
    const clamped = Math.max(0, Math.min(this.duration, t));
    if (this.video) this.video.currentTime = clamped;
    else this.simTime = clamped;
    this.emitTick();
  }

  private clearRange() {
    if (!this.range) return;
    this.range = null;
    this.emitState();
  }

  private loop = (ts: number) => {
    if (!this.playing) return;
    if (!this.video) {
      if (this.lastTs) this.simTime += ((ts - this.lastTs) / 1000) * this.rate;
    }
    this.lastTs = ts;
    const range = this.range;
    if (range && this.time >= range.end) {
      if (range.loop) {
        this.seekRaw(range.start);
      } else {
        this.pause();
        this.seekRaw(range.end);
        return;
      }
    }
    if (!this.video && this.simTime >= this.simEnd) {
      this.simTime = this.simEnd;
      this.pause();
      return;
    }
    this.emitTick();
    this.raf = requestAnimationFrame(this.loop);
  };

  private emitTick() {
    this.tickListeners.forEach((fn) => fn());
  }

  private emitState() {
    this.stateListeners.forEach((fn) => fn());
  }
}

export const clock = new PlaybackClock();

/** Re-renders only on play/pause and rate changes, never per frame. */
export function usePlaying(): boolean {
  return useSyncExternalStore(clock.onState, () => clock.playing);
}

export function useLooping(): boolean {
  return useSyncExternalStore(clock.onState, () => clock.looping);
}

export function usePlaybackRate(): number {
  return useSyncExternalStore(clock.onState, () => clock.rate);
}
