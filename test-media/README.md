# Media test corpus (MED-04)

Local clips used to verify media/probe/playback/VFR work before changing the media layer.
**Run this checklist before every media change.**

## Privacy

Films and client previews are unreleased. **Nothing leaves the machine without explicit consent.**

- Put real clips under the category folders below.
- Large private media is **gitignored** — do not commit it.
- Tiny public/generated fixtures may live under `fixtures/` (e.g. `vfr-short.*`).
- Orchestrator updates `docs/backlog.md` MED-04 status when this layout + check script land; keep this README as the agent runbook.

## Layout

| Path | Purpose |
|------|---------|
| `h264-mov/` | H.264 `.mov` preview (typical Nollywood export) |
| `h264-mp4/` | H.264 `.mp4` |
| `mkv/` | Matroska sample |
| `multi-audio/` | Multiple audio tracks |
| `vfr-phone/` | VFR phone footage (**critical for MED-03**) |
| `long-80min/` | ~80 min file (waveform / perf; soft-required) |
| `fixtures/` | Tiny committed or generated samples only |

Expected: one (or more) media files per category folder. Extensions vary (`.mov`, `.mp4`, `.mkv`, …).

## Quick check

```sh
./scripts/check-media-corpus.sh
```

Exits non-zero if critical categories for a media change are missing (`h264-mov`, `h264-mp4`, `mkv`, `multi-audio`, `vfr-phone`).
`long-80min` warns only (soft-fail) so agents can still iterate without an 80‑min file.

## Manual verification (before media PRs)

1. **Corpus present** — `./scripts/check-media-corpus.sh` (fix critical gaps).
2. **Open clip** — launch the app, open a file from each critical folder (at least `vfr-phone/` for MED-03).
3. **Frame step** — with the clip open, use ← / →; playhead must land on **true source frames** (not `1/fps` guesses), especially on VFR phone footage.
4. **Snap all** — run snap-all-times-to-frames; cue edges should align to source frame timestamps.
5. **Multi-audio / containers** — smoke-open `mkv/` and `multi-audio/`; probe should list tracks without crashing.
6. **Perf (optional)** — open `long-80min/` and confirm waveform / scrub stay usable.

Generated short VFR fixture (when the other agent’s script exists):

```sh
./scripts/generate-vfr-fixture.sh   # → test-media/fixtures/vfr-short.*
```

Use `fixtures/vfr-short.*` for automated/unit-ish checks; keep real phone VFR in `vfr-phone/` for end-to-end.

## Filling the corpus

Copy local samples into the folders (names arbitrary). Example:

```sh
cp ~/Movies/preview.mov test-media/h264-mov/
cp ~/Movies/phone-vfr.mp4 test-media/vfr-phone/
```

Do **not** `git add` large private files; `.gitignore` blocks media binaries under `test-media/**` while keeping READMEs, scripts, and `fixtures/`.

## Corpus status (local)

Critical folders are expected to hold private/local samples (gitignored). As of the last agent fill:

| Folder | Status |
|--------|--------|
| `h264-mov/` | Local H.264 `.mov` |
| `h264-mp4/` | Local H.264 `.mp4` (remux of a preview) |
| `mkv/` | Local Matroska remux |
| `multi-audio/` | Local dual-AAC sample |
| `vfr-phone/` | Local VFR H.264 `.mov` (real irregular frame intervals) |
| `long-80min/` | Still empty (soft; no ~80‑min clip on this machine) |

Re-run `./scripts/check-media-corpus.sh` after adding or replacing clips. Prefer real Nollywood previews / phone VFR when available; remuxes are fine for container/track smoke.
