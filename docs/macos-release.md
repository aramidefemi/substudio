# macOS signed + notarised releases (DLV-04)

> Day-to-day public releases (version tags, CI DMGs, website) are in [`releasing.md`](releasing.md). This page is only about adding Apple Developer ID signing + notarisation on top.

Ship a Developer ID–signed `.app` / `.dmg` that Gatekeeper accepts. Auto-update is documented here but **not wired** until a public update endpoint and signing keys exist.

## What you need (Apple Developer)

| Secret / tool | Purpose |
|---|---|
| Apple Developer Program membership | Certificates |
| Developer ID Application certificate | Codesign the `.app` |
| (Optional) Developer ID Installer | `.pkg` only; we ship `.dmg` |
| App-specific password **or** App Store Connect API key | Notarisation |
| Team ID | Notary + identity matching |

**Never commit certificates, `.p12` files, API keys, or passwords.** Put them in the Keychain, CI secrets, or a local env file that is gitignored (see below).

## Environment variables

Tauri 2 / `tauri-cli` pick these up for `pnpm tauri build` on macOS:

```sh
# Codesign (required for a distributable build)
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
# Optional: import a .p12 in CI
# export APPLE_CERTIFICATE="$(base64 -i cert.p12)"
# export APPLE_CERTIFICATE_PASSWORD="…"
# export KEYCHAIN_PASSWORD="…"   # CI ephemeral keychain

# Notarise (one of the two auth methods)
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"   # appleid.apple.com → App-Specific Passwords
export APPLE_TEAM_ID="TEAMID"

# Or API key (preferred for CI):
# export APPLE_API_KEY="XXXXXXXXXX"
# export APPLE_API_ISSUER="uuid-from-appstoreconnect"
# export APPLE_API_KEY_PATH="$HOME/private_keys/AuthKey_XXXXXXXXXX.p8"
```

Optional local file (gitignored): `~/.cursor/secrets/substudio-release.env` or `scratchpad/release.env`. Load with:

```sh
set -a && source /path/to/substudio-release.env && set +a
```

## Build + notarise

From the repo root (after `pnpm install` and a libass-capable ffmpeg via `scripts/fetch-ffmpeg.sh`):

```sh
./scripts/release-macos.sh
# or: pnpm release:macos
```

The script:

1. Refuses to invent credentials — exits with a clear message if signing/notary env is incomplete.
2. Runs `pnpm tauri build` (produces `.app` and `.dmg` under `src-tauri/target/release/bundle/`).
3. When notary env is present, submits the `.dmg` with `xcrun notarytool` and staples with `xcrun stapler`.

Unsigned local smoke builds stay available as `pnpm tauri build` without those env vars (ad-hoc / unsigned — not for sharing outside your machine).

## Auto-update (blocked)

Tauri’s updater needs:

- A static JSON endpoint (or GitHub releases) listing version + download URLs + signature
- A minisign / Tauri updater private key pair
- The updater plugin wired in `tauri.conf.json` + capabilities

**Not enabled in this milestone:** shipping updater without those secrets would either no-op or point at a fake URL. When ready:

1. `pnpm add @tauri-apps/plugin-updater` + Rust `tauri-plugin-updater`
2. Generate keys with `tauri signer generate`
3. Host release artifacts + `latest.json` over HTTPS
4. Add an in-app “Check for updates” command that only runs after explicit user consent (privacy: films stay local; update checks are network)

## Verify a release

```sh
codesign -dv --verbose=4 dist-or-bundle/Substudio.app
spctl --assess --type execute -vv dist-or-bundle/Substudio.app
xcrun stapler validate path/to/Substudio_*.dmg
```

## Blockers (backlog 🟡)

- No Apple signing certificate / Team ID / notary credentials in this environment.
- No public update feed or updater keypair yet.
