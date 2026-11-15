#!/usr/bin/env bash
# Generate a tiny synthetic VFR H.264 clip for MED-03/04 stepping/snap tests.
#
# Usage:
#   ./scripts/generate-vfr-fixture.sh
#   ./scripts/generate-vfr-fixture.sh --force   # overwrite existing fixture
#   ./scripts/generate-vfr-fixture.sh -h
#
# Output: test-media/fixtures/vfr-short.mp4
# Prefer project ffmpeg/ffprobe sidecars; fall back to PATH.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/test-media/fixtures/vfr-short.mp4"
FORCE=0

usage() {
  cat <<'EOF'
Generate a short (~3s) synthetic VFR H.264 clip for frame-step / snap tests.

Usage:
  ./scripts/generate-vfr-fixture.sh [--force|-f]
  ./scripts/generate-vfr-fixture.sh --help|-h

Output:
  test-media/fixtures/vfr-short.mp4

Method:
  Encode four short CFR segments at 12 / 24 / 30 / 48 fps, then concat
  with stream copy so packet PTS intervals stay irregular (true VFR).

Tools:
  Prefers src-tauri/binaries/ffmpeg-<triple> (and ffprobe) from
  scripts/fetch-ffmpeg.sh; otherwise uses ffmpeg/ffprobe on PATH.

  Note: the minimal LGPL sidecar may lack libx264 / lavfi. If encode
  fails with the sidecar, install a full ffmpeg (e.g. Homebrew) or
  leave generation to PATH ffmpeg.
EOF
}

for arg in "$@"; do
  case "$arg" in
    -h|--help) usage; exit 0 ;;
    -f|--force) FORCE=1 ;;
    *)
      echo "unknown arg: $arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

host_triple() {
  if command -v rustc >/dev/null 2>&1; then
    rustc --print host-tuple 2>/dev/null && return
  fi
  echo "aarch64-apple-darwin"
}

resolve_tool() {
  local name="$1"
  local triple
  triple="$(host_triple)"
  local sidecar="$ROOT/src-tauri/binaries/${name}-${triple}"
  if [[ -x "$sidecar" ]]; then
    echo "$sidecar"
    return
  fi
  if command -v "$name" >/dev/null 2>&1; then
    command -v "$name"
    return
  fi
  echo ""
}

FFMPEG="$(resolve_tool ffmpeg)"
FFPROBE="$(resolve_tool ffprobe)"

if [[ -z "$FFMPEG" ]]; then
  echo "error: ffmpeg not found (run scripts/fetch-ffmpeg.sh or install ffmpeg)" >&2
  exit 1
fi

if [[ -f "$OUT" && "$FORCE" -eq 0 ]]; then
  echo "exists: $OUT ($(wc -c <"$OUT" | tr -d ' ') bytes) — pass --force to regenerate"
  exit 0
fi

TMP="$(mktemp -d "${TMPDIR:-/tmp}/substudio-vfr.XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo "ffmpeg: $FFMPEG"
[[ -n "$FFPROBE" ]] && echo "ffprobe: $FFPROBE"

# Four CFR chunks at different rates → true VFR after concat -c copy.
RATES=(12 24 30 48)
SEG_DUR=0.8
LIST="$TMP/concat.txt"
: >"$LIST"

for rate in "${RATES[@]}"; do
  seg="$TMP/seg_${rate}.mp4"
  echo "encoding ${rate} fps × ${SEG_DUR}s → $(basename "$seg")"
  if ! "$FFMPEG" -y -hide_banner -loglevel error \
    -f lavfi -i "testsrc2=size=320x180:rate=${rate}:duration=${SEG_DUR}" \
    -c:v libx264 -preset ultrafast -crf 35 -pix_fmt yuv420p -an \
    -movflags +faststart \
    "$seg"; then
    echo "error: encode failed with $FFMPEG" >&2
    echo "hint: project LGPL sidecar may lack libx264/lavfi; use Homebrew ffmpeg on PATH" >&2
    exit 1
  fi
  # concat demuxer needs paths; quote for spaces.
  printf "file '%s'\n" "$seg" >>"$LIST"
done

mkdir -p "$(dirname "$OUT")"
"$FFMPEG" -y -hide_banner -loglevel error \
  -f concat -safe 0 -i "$LIST" -c copy \
  -movflags +faststart \
  "$OUT"

BYTES="$(wc -c <"$OUT" | tr -d ' ')"
echo "wrote $OUT ($BYTES bytes)"

if [[ -n "$FFPROBE" ]]; then
  echo "--- stream rates ---"
  "$FFPROBE" -hide_banner -v error -select_streams v:0 \
    -show_entries stream=avg_frame_rate,r_frame_rate,nb_frames,duration \
    -of default=nokey=0:noprint_wrappers=1 "$OUT"
  echo "--- first packet pts / duration (expect mixed intervals) ---"
  # Avoid pipefail SIGPIPE when head closes early.
  "$FFPROBE" -hide_banner -v error -select_streams v:0 \
    -show_entries packet=pts_time,duration_time -of csv=p=0 "$OUT" \
    | head -16 || true
fi
