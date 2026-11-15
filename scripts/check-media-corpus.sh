#!/usr/bin/env bash
# MED-04 — list corpus presence; fail if critical categories lack media files.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORPUS="${ROOT}/test-media"

# Critical for media-layer changes (exit non-zero if any missing).
CRITICAL=(h264-mov h264-mp4 mkv multi-audio vfr-phone)
# Soft: warn only (waveform / perf).
SOFT=(long-80min)

MEDIA_GLOB='*.mov *.MOV *.mp4 *.MP4 *.m4v *.M4V *.mkv *.MKV *.webm *.WEBM *.avi *.AVI *.ts *.TS *.m2ts *.M2TS'

has_media() {
  local dir="$1"
  [[ -d "$dir" ]] || return 1
  local f
  # shellcheck disable=SC2086
  for pattern in $MEDIA_GLOB; do
    for f in "$dir"/$pattern; do
      [[ -f "$f" ]] && return 0
    done
  done
  return 1
}

present=()
missing_critical=()
missing_soft=()

echo "Media test corpus: ${CORPUS}"
echo

check_cat() {
  local name="$1" kind="$2"
  local dir="${CORPUS}/${name}"
  if has_media "$dir"; then
    local count=0
    local f
    # shellcheck disable=SC2086
    for pattern in $MEDIA_GLOB; do
      for f in "$dir"/$pattern; do
        [[ -f "$f" ]] && count=$((count + 1))
      done
    done
    printf '  OK   %-14s (%d media file(s))\n' "$name" "$count"
    present+=("$name")
  else
    printf '  MISS %-14s (no media under %s)\n' "$name" "test-media/${name}/"
    if [[ "$kind" == critical ]]; then
      missing_critical+=("$name")
    else
      missing_soft+=("$name")
    fi
  fi
}

echo "Critical (required before media changes):"
for c in "${CRITICAL[@]}"; do check_cat "$c" critical; done
echo
echo "Soft (recommended; warn only):"
for c in "${SOFT[@]}"; do check_cat "$c" soft; done

fixtures="${CORPUS}/fixtures"
echo
if [[ -d "$fixtures" ]] && compgen -G "${fixtures}/vfr-short.*" > /dev/null 2>&1; then
  echo "Fixture: test-media/fixtures/vfr-short.* present"
else
  echo "Fixture: test-media/fixtures/vfr-short.* not found (optional; generate via scripts/generate-vfr-fixture.sh when available)"
fi

echo
echo "Manual verification (high level):"
echo "  1. Open a clip from each critical folder in the app."
echo "  2. ← / → frame step — playhead must land on true source frames (esp. vfr-phone/)."
echo "  3. Run snap-all-times-to-frames — cue edges align to source timestamps."
echo "  4. Smoke-open mkv/ + multi-audio/; probe lists tracks."
echo "  5. Optional: open long-80min/ for waveform/perf."
echo "  See test-media/README.md for the full checklist."
echo

if ((${#missing_soft[@]})); then
  echo "Warning: soft categories missing: ${missing_soft[*]}"
fi

if ((${#missing_critical[@]})); then
  echo "FAIL: critical categories missing media: ${missing_critical[*]}"
  echo "Copy local samples into test-media/<category>/ (gitignored). See test-media/README.md."
  exit 1
fi

echo "PASS: all critical corpus categories present."
exit 0
