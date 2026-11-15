# Bundled ffmpeg / ffprobe (MED-01)

Tauri `externalBin` expects:

| File | Role |
|---|---|
| `ffprobe-<rust-target-triple>` | Media probe + VFR frame timestamps |
| `ffmpeg-<rust-target-triple>` | Waveform PCM fallback + MED-02 editing proxy (VideoToolbox H.264 on macOS) |

Example (Apple Silicon): `ffprobe-aarch64-apple-darwin`, `ffmpeg-aarch64-apple-darwin`.

## Licence

Ship **LGPL** builds only (`--disable-gpl --disable-nonfree`). Generate them with:

```sh
./scripts/fetch-ffmpeg.sh
```

That script builds a minimal LGPL ffprobe/ffmpeg from ffmpeg.org source into this folder. Binaries are gitignored — run the script once per machine (or in CI) before `pnpm tauri build`.

Verify:

```sh
./ffprobe-aarch64-apple-darwin -hide_banner -buildconf | grep -E 'enable-gpl|License'
# expect: no --enable-gpl; LGPL
```
