#!/usr/bin/env bash
# Fetch or build LGPL ffmpeg/ffprobe sidecars into src-tauri/binaries/.
# Prefer a local LGPL build (scripts/build-ffprobe-lgpl.sh). Falls back to
# downloading static builds only when SUBSTUDIO_ALLOW_GPL_FFMPEG=1 (dev only).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/src-tauri/binaries"
TRIPLE="${1:-$(rustc --print host-tuple 2>/dev/null || echo aarch64-apple-darwin)}"
mkdir -p "$BIN"

need() {
  local name="$1"
  local dest="$BIN/${name}-${TRIPLE}"
  if [[ -x "$dest" ]]; then
    echo "ok $dest"
    return 0
  fi
  return 1
}

if need ffprobe && need ffmpeg; then
  exit 0
fi

SCRATCH="$ROOT/scratchpad/ffmpeg-build"
mkdir -p "$SCRATCH"

build_lgpl_ffprobe() {
  local src="$SCRATCH/ffmpeg-src"
  if [[ ! -d "$src/.git" ]]; then
    git clone --depth 1 https://git.ffmpeg.org/ffmpeg.git "$src"
  fi
  (
    cd "$src"
    ./configure \
      --disable-gpl --disable-nonfree --disable-debug --disable-doc \
      --disable-ffplay --disable-ffmpeg --enable-ffprobe \
      --disable-network --disable-devices --disable-autodetect \
      --enable-protocol=file \
      --enable-demuxer=mov,matroska,avi,mpegts,mp3,wav,flac,ogg,aac \
      --enable-parser=h264,hevc,aac,mpegaudio,opus,vorbis \
      --enable-decoder=h264,hevc,aac,mp3,pcm_s16le,flac,opus,vorbis \
      --disable-filters --disable-hwaccels --disable-iconv
    make -j"$(sysctl -n hw.ncpu 2>/dev/null || nproc)" ffprobe
    cp -f ffprobe "$BIN/ffprobe-$TRIPLE"
    chmod +x "$BIN/ffprobe-$TRIPLE"
    if command -v codesign >/dev/null; then
      xattr -cr "$BIN/ffprobe-$TRIPLE" 2>/dev/null || true
      codesign -s - --force "$BIN/ffprobe-$TRIPLE" 2>/dev/null || true
    fi
  )
  echo "built LGPL ffprobe → $BIN/ffprobe-$TRIPLE"
}

build_lgpl_ffmpeg() {
  local src="$SCRATCH/ffmpeg-src"
  if [[ ! -d "$src/.git" ]]; then
    git clone --depth 1 https://git.ffmpeg.org/ffmpeg.git "$src"
  fi
  # MED-02: AAC + MP4 for editing proxies; on macOS also VideoToolbox H.264 (system framework, not GPL).
  # Waveform PCM fallback still uses pcm_f32le / wav / null. Dev can fall back to PATH ffmpeg.
  local encoders="pcm_f32le,aac"
  local muxers="null,wav,mp4"
  local vt_flags=()
  case "$(uname -s)" in
    Darwin)
      encoders+=",h264_videotoolbox"
      vt_flags=(
        --enable-hwaccel=videotoolbox
        --extra-ldflags="-framework VideoToolbox -framework CoreMedia -framework CoreVideo -framework CoreFoundation"
      )
      ;;
  esac
  (
    cd "$src"
    ./configure \
      --disable-gpl --disable-nonfree --disable-debug --disable-doc \
      --disable-ffplay --enable-ffmpeg --disable-ffprobe \
      --disable-network --disable-devices --disable-autodetect \
      --enable-protocol=file,pipe \
      --enable-demuxer=mov,matroska,avi,mpegts,mp3,wav,flac,ogg,aac,ac3 \
      --enable-muxer="$muxers" \
      --enable-parser=h264,hevc,aac,mpegaudio,opus,vorbis,ac3 \
      --enable-decoder=h264,hevc,aac,mp3,pcm_s16le,pcm_s16be,pcm_s24le,pcm_s32le,pcm_f32le,flac,opus,vorbis,ac3,eac3 \
      --enable-encoder="$encoders" \
      --enable-filter=aresample,aformat \
      --disable-iconv \
      "${vt_flags[@]}"
    make -j"$(sysctl -n hw.ncpu 2>/dev/null || nproc)" ffmpeg
    cp -f ffmpeg "$BIN/ffmpeg-$TRIPLE"
    chmod +x "$BIN/ffmpeg-$TRIPLE"
    if command -v codesign >/dev/null; then
      xattr -cr "$BIN/ffmpeg-$TRIPLE" 2>/dev/null || true
      codesign -s - --force "$BIN/ffmpeg-$TRIPLE" 2>/dev/null || true
    fi
  )
  echo "built LGPL ffmpeg → $BIN/ffmpeg-$TRIPLE"
}

if ! need ffprobe; then
  echo "building LGPL ffprobe (this takes a minute)…"
  build_lgpl_ffprobe
fi

if ! need ffmpeg; then
  echo "building LGPL ffmpeg (this takes a minute)…"
  build_lgpl_ffmpeg
fi

echo "done"
"$BIN/ffprobe-$TRIPLE" -version | head -1
"$BIN/ffmpeg-$TRIPLE" -version | head -1
