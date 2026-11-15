/// <reference types="vite/client" />

/** WebKit exposes HTMLMediaElement.audioTracks for multi-track files (PLY-05). */
interface AudioTrack {
  enabled: boolean;
  id: string;
  kind: string;
  label: string;
  language: string;
}

interface AudioTrackList {
  readonly length: number;
  [index: number]: AudioTrack;
}

interface HTMLMediaElement {
  audioTracks?: AudioTrackList;
}
