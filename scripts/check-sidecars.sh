#!/usr/bin/env bash
# Fail if the bundled ffmpeg/ffprobe would not run on a clean Mac:
# every linked library must ship with macOS, the build must be LGPL,
# and ffmpeg must have the encoders/filters the app relies on.
#   scripts/check-sidecars.sh [target-triple]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TRIPLE="${1:-$(rustc --print host-tuple)}"
fail=0

for name in ffmpeg ffprobe; do
  bin="$ROOT/src-tauri/binaries/$name-$TRIPLE"
  [[ -x "$bin" ]] || { echo "missing $bin (run scripts/fetch-ffmpeg.sh $TRIPLE)"; exit 1; }
  foreign="$(otool -L "$bin" | tail -n +2 | awk '{print $1}' | grep -vE '^(/usr/lib/|/System/Library/)' || true)"
  if [[ -n "$foreign" ]]; then
    echo "error: $name links non-system libraries:"; echo "$foreign"; fail=1
  fi
  if "$bin" -hide_banner -buildconf | grep -E -- '--enable-(gpl|nonfree)' >/dev/null; then
    echo "error: $name is not an LGPL build"; fail=1
  fi
  echo "ok $name: $("$bin" -version | head -1)"
done

ff="$ROOT/src-tauri/binaries/ffmpeg-$TRIPLE"
"$ff" -hide_banner -filters | grep -w subtitles >/dev/null || { echo "error: ffmpeg lacks the libass subtitles filter (burn-in)"; fail=1; }
"$ff" -hide_banner -encoders | grep -w h264_videotoolbox >/dev/null || { echo "error: ffmpeg lacks h264_videotoolbox (proxies, burn-in)"; fail=1; }

exit "$fail"
