#!/usr/bin/env bash
# Build libass and its dependencies (freetype, fribidi, harfbuzz) as static
# libraries so the bundled ffmpeg sidecar has no Homebrew dylib dependencies
# and runs on a Mac that has never seen Homebrew.
#
#   scripts/build-libass-static.sh <prefix>
#
# Versions + SHA-256 are pinned. Fonts come from Core Text (no fontconfig).
# Needs: meson, ninja, pkg-config, curl. Honors MACOSX_DEPLOYMENT_TARGET.
set -euo pipefail

PREFIX="${1:?usage: build-libass-static.sh <prefix>}"
mkdir -p "$PREFIX"
PREFIX="$(cd "$PREFIX" && pwd)"
SRC="$PREFIX/src"
mkdir -p "$SRC"

if [[ -f "$PREFIX/lib/libass.a" && -f "$PREFIX/lib/pkgconfig/libass.pc" ]]; then
  echo "ok static libass in $PREFIX"
  exit 0
fi

export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig"
export PKG_CONFIG_LIBDIR="$PREFIX/lib/pkgconfig"
export MACOSX_DEPLOYMENT_TARGET="${MACOSX_DEPLOYMENT_TARGET:-11.0}"

fetch() {
  local url="$1" sha="$2" out="$SRC/$(basename "$1")"
  if [[ ! -f "$out" ]]; then
    curl -fsSL --retry 3 -o "$out.part" "$url"
    mv "$out.part" "$out"
  fi
  echo "$sha  $out" | shasum -a 256 -c - >/dev/null || {
    echo "error: checksum mismatch for $out" >&2
    rm -f "$out"
    exit 1
  }
  tar -xJf "$out" -C "$SRC"
}

meson_build() {
  local dir="$1"; shift
  (
    cd "$SRC/$dir"
    rm -rf _build
    meson setup _build \
      --prefix="$PREFIX" --libdir=lib \
      --buildtype=release --default-library=static \
      --wrap-mode=nofallback \
      "$@"
    ninja -C _build
    ninja -C _build install
  )
}

FREETYPE=2.14.3
FRIBIDI=1.0.18
HARFBUZZ=15.2.0
LIBASS=0.17.5

fetch "https://download.savannah.gnu.org/releases/freetype/freetype-$FREETYPE.tar.xz" \
  36bc4f1cc413335368ee656c42afca65c5a3987e8768cc28cf11ba775e785a5f
meson_build "freetype-$FREETYPE" \
  -Dzlib=disabled -Dbzip2=disabled -Dpng=disabled -Dharfbuzz=disabled -Dbrotli=disabled

fetch "https://github.com/fribidi/fribidi/releases/download/v$FRIBIDI/fribidi-$FRIBIDI.tar.xz" \
  1de5e8073d035388b71d0b2d452b1da1f8caeea8a7702997b401fe1b6250727f
meson_build "fribidi-$FRIBIDI" -Ddocs=false -Dtests=false -Dbin=false

fetch "https://github.com/harfbuzz/harfbuzz/releases/download/$HARFBUZZ/harfbuzz-$HARFBUZZ.tar.xz" \
  e2ec49090744383cdbe7df808c1cedaafba06a97be8dc4211fe546ba585f12cb
meson_build "harfbuzz-$HARFBUZZ" \
  -Dfreetype=enabled -Dglib=disabled -Dgobject=disabled -Dcairo=disabled -Dicu=disabled \
  -Dchafa=disabled -Dgraphite2=disabled -Dcoretext=disabled \
  -Dtests=disabled -Ddocs=disabled -Dutilities=disabled -Dintrospection=disabled

fetch "https://github.com/libass/libass/releases/download/$LIBASS/libass-$LIBASS.tar.xz" \
  2dca25c0e0c837ddf00b52011b3f82cac1e4ddd3ad018227806b0c2288864acc
meson_build "libass-$LIBASS" \
  -Dfontconfig=disabled -Dcoretext=enabled -Ddirectwrite=disabled -Dlibunibreak=disabled \
  -Dasm=disabled -Dtest=disabled -Dcompare=disabled -Dprofile=disabled -Dfuzz=disabled \
  -Dcheckasm=disabled

echo "built static libass → $PREFIX"
