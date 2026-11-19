# Releasing Substudio (DLV-05)

Public builds are GitHub releases built by CI from a version tag. The website (`site/`, GitHub Pages) always links to the latest release.

- Website: https://aramidefemi.github.io/substudio/
- Releases: https://github.com/aramidefemi/substudio/releases

## Versioning

[Semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`. While we're in preview (0.x):

- **Minor** (`0.2.0`): a build she should try, with new features or behaviour changes.
- **Patch** (`0.1.1`): fixes only.
- `1.0.0`: she uses Substudio for whole films by choice (the north star in `backlog.md`).

The version lives in four files that must always agree: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`. Never edit them by hand; use the script.

## Cutting a release

1. On `main` with a clean tree and `pnpm check` passing.
2. Add a `## x.y.z` section at the top of `CHANGELOG.md` and commit it. Write it for the subtitler, not for developers: what she can now do, what changed, and known limits. It becomes the release notes.
3. Run:

   ```sh
   pnpm release 0.2.0 --push
   ```

   This sets the version everywhere, commits `Release v0.2.0`, creates the annotated tag `v0.2.0` and pushes `main` and the tag. Leave off `--push` to inspect first, then run `git push origin main v0.2.0`.

4. The **Release** workflow (`.github/workflows/release.yml`) then:
   - checks the tag matches all four versions and that the changelog section exists;
   - creates a draft release with the changelog notes and install instructions;
   - builds on `macos-15` (Apple Silicon) and `macos-15-intel` (Intel): the LGPL ffmpeg/ffprobe sidecars with static libass, `scripts/check-sidecars.sh`, `pnpm check` (Apple Silicon job), then `pnpm tauri build --bundles app,dmg`;
   - uploads `Substudio-mac-apple-silicon.dmg` and `Substudio-mac-intel.dmg`, and publishes the release as **Latest**.

   Watch it with `gh run watch` or in the Actions tab. It takes about 20 minutes cold and less once the ffmpeg cache is warm.

5. Check the downloads on the website.

To rebuild an existing tag (for example after fixing CI), run the workflow manually: `gh workflow run release.yml -f tag=v0.2.0`. Assets are replaced in place.

## Why the asset names never change

The website links to `https://github.com/aramidefemi/substudio/releases/latest/download/Substudio-mac-apple-silicon.dmg` (and `-intel`). GitHub resolves `latest` to the newest non-draft, non-prerelease release, so the site never needs editing for a new version. The version label on the page is read from the GitHub API at load time.

Don't mark releases as pre-release: `latest` skips them and the website would keep serving the previous build.

## ffmpeg in release builds

The app bundles `ffmpeg` and `ffprobe` (`externalBin`). A release build must not depend on Homebrew, because the user's Mac won't have it:

- `scripts/fetch-ffmpeg.sh` builds a pinned ffmpeg tag (`FFMPEG_REF`, default `n8.1.3`), LGPL only, with `MACOSX_DEPLOYMENT_TARGET=11.0`.
- libass and its dependencies (freetype, fribidi, harfbuzz) are built as **static** libraries by `scripts/build-libass-static.sh` from pinned, checksummed tarballs. Fonts come from Core Text, so there is no fontconfig.
- `scripts/check-sidecars.sh` fails the build if either binary links anything outside `/usr/lib` or `/System/Library`, is not LGPL, or lacks the `subtitles` filter or `h264_videotoolbox`.

Locally, delete `src-tauri/binaries/ff*-<triple>` and re-run `./scripts/fetch-ffmpeg.sh` to get the same binaries CI ships. You'll need `brew install meson ninja pkg-config` (and `nasm` on Intel).

## Signing (current state)

Builds are **ad-hoc signed** (`bundle.macOS.signingIdentity: "-"`), not Developer ID signed or notarised (that's DLV-04, in `macos-release.md`). On first launch macOS says it can't verify the app; the user clicks **Done**, then **System Settings → Privacy & Security → Open Anyway**. The website and every release note explain this.

When an Apple Developer account exists, add the `APPLE_*` secrets from `macos-release.md` to the repo and pass them as env to the *Build app* step. Tauri then signs with the Developer ID (overriding `"-"`) and notarises.

## The website

`site/` is plain HTML, CSS and JS with no build step. `.github/workflows/pages.yml` publishes it whenever `site/**` changes on `main`. Colours mirror the tokens in `style-guide.md`, and Inter is self-hosted, including the subset that covers Yoruba tone marks. Preview locally by opening `site/index.html` in a browser.
