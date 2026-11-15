import { toast } from "sonner";
import type { Command } from "@/app/commands/registry";
import {
  audioTrackLabel,
  cycleAudioOrdinal,
  listAudioTracks,
  MAX_AUDIO_TRACK_SLOTS,
} from "@/features/media/audioTracks";
import { setAudioTrack, useMedia } from "@/features/media/store";

export function selectAudioTrack(ordinal: number) {
  const tracks = listAudioTracks(useMedia.getState().info?.tracks ?? []);
  if (tracks.length === 0) {
    toast("No audio tracks", { description: "Open a video with audio first." });
    return;
  }
  if (ordinal < 0 || ordinal >= tracks.length) {
    toast("Audio track not available", {
      description: `This file has ${tracks.length} audio track${tracks.length === 1 ? "" : "s"}.`,
    });
    return;
  }
  setAudioTrack(ordinal);
  toast(audioTrackLabel(tracks[ordinal]!, ordinal));
}

export function cycleAudioTrack(delta: number) {
  const tracks = listAudioTracks(useMedia.getState().info?.tracks ?? []);
  if (tracks.length < 2) {
    toast(tracks.length === 0 ? "No audio tracks" : "Only one audio track");
    return;
  }
  selectAudioTrack(cycleAudioOrdinal(tracks.length, useMedia.getState().audioTrack, delta));
}

/** Playback commands for picking / cycling audio tracks (PLY-05). */
export const AUDIO_TRACK_COMMANDS: Command[] = [
  {
    id: "playback.audioTrack.prev",
    label: "Previous audio track",
    group: "Playback",
    run: () => cycleAudioTrack(-1),
  },
  {
    id: "playback.audioTrack.next",
    label: "Next audio track",
    group: "Playback",
    run: () => cycleAudioTrack(1),
  },
  ...Array.from({ length: MAX_AUDIO_TRACK_SLOTS }, (_, i) => ({
    id: `playback.audioTrack.${i}`,
    label: `Audio track ${i + 1}`,
    group: "Playback",
    run: () => selectAudioTrack(i),
  })),
];
