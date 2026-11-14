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

/**
 * The single source of playback time. Lives outside React: per-frame consumers
 * (waveform, video overlay, timecode readouts) subscribe with `onTick` and
 * write to the canvas/DOM directly. Without a video it runs a simulated clock.
 */
class PlaybackClock {
  playing = false;
  rate = 1;
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

  play() {
    if (this.playing) return;
    if (!this.video && this.simTime >= this.simEnd) this.simTime = 0;
    this.playing = true;
    this.video?.play().catch(() => this.pause());
    this.lastTs = 0;
    this.raf = requestAnimationFrame(this.loop);
    this.emitState();
  }

  pause() {
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
    const clamped = Math.max(0, Math.min(this.duration, t));
    if (this.video) this.video.currentTime = clamped;
    else this.simTime = clamped;
    this.emitTick();
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

  private loop = (ts: number) => {
    if (!this.playing) return;
    if (!this.video) {
      if (this.lastTs) this.simTime += ((ts - this.lastTs) / 1000) * this.rate;
      if (this.simTime >= this.simEnd) {
        this.simTime = this.simEnd;
        this.pause();
        return;
      }
    }
    this.lastTs = ts;
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

export function usePlaybackRate(): number {
  return useSyncExternalStore(clock.onState, () => clock.rate);
}
