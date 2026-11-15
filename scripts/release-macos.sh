#!/usr/bin/env bash
# Build a signed (+ optionally notarised) macOS Substudio release.
# Does not invent credentials — exits if required env is missing.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

die() { echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }

[[ "$(uname -s)" == "Darwin" ]] || die "macOS only"

SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-}"
if [[ -z "$SIGNING_IDENTITY" ]]; then
  cat >&2 <<'MSG'
error: APPLE_SIGNING_IDENTITY is not set.

Set Apple Developer ID signing + notary env (see docs/macos-release.md), e.g.:
  export APPLE_SIGNING_IDENTITY="Developer ID Application: … (TEAMID)"
  export APPLE_ID=… APPLE_PASSWORD=… APPLE_TEAM_ID=…

For an unsigned local build only, run: pnpm tauri build
MSG
  exit 1
fi

has_notary=0
if [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_ISSUER:-}" && -n "${APPLE_API_KEY_PATH:-}" ]]; then
  has_notary=1
elif [[ -n "${APPLE_ID:-}" && -n "${APPLE_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]]; then
  has_notary=1
fi

if [[ "$has_notary" -eq 0 ]]; then
  cat >&2 <<'MSG'
error: notary credentials missing.

Provide either:
  APPLE_ID + APPLE_PASSWORD + APPLE_TEAM_ID
or:
  APPLE_API_KEY + APPLE_API_ISSUER + APPLE_API_KEY_PATH

See docs/macos-release.md. Refusing to ship an un-notarised Developer ID build from this script.
MSG
  exit 1
fi

command -v pnpm >/dev/null || die "pnpm not found"
command -v xcrun >/dev/null || die "xcrun not found (install Xcode CLT)"

if [[ ! -e src-tauri/binaries/ffmpeg-aarch64-apple-darwin && ! -e src-tauri/binaries/ffmpeg-x86_64-apple-darwin ]]; then
  info "ffmpeg sidecar missing — run scripts/fetch-ffmpeg.sh (needs libass for burn-in)"
fi

info "Building signed Substudio (identity: $SIGNING_IDENTITY)"
pnpm tauri build

BUNDLE="$ROOT/src-tauri/target/release/bundle"
DMG="$(find "$BUNDLE/dmg" -name '*.dmg' 2>/dev/null | head -1 || true)"
APP="$(find "$BUNDLE/macos" -name '*.app' 2>/dev/null | head -1 || true)"

[[ -n "$DMG" ]] || die "no .dmg under $BUNDLE/dmg — check tauri build output"
info "Built: $DMG"
[[ -n "$APP" ]] && info "App:  $APP"

info "Submitting DMG to Apple notary"
if [[ -n "${APPLE_API_KEY:-}" ]]; then
  xcrun notarytool submit "$DMG" \
    --key "$APPLE_API_KEY_PATH" \
    --key-id "$APPLE_API_KEY" \
    --issuer "$APPLE_API_ISSUER" \
    --wait
else
  xcrun notarytool submit "$DMG" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait
fi

info "Stapling"
xcrun stapler staple "$DMG"
[[ -n "$APP" ]] && xcrun stapler staple "$APP" 2>/dev/null || true

info "Validating"
xcrun stapler validate "$DMG"
spctl --assess --type open --context context:primary-signature -vv "$DMG" || true

info "Done. Distribute only the stapled DMG."
echo "$DMG"
