# Media fixtures

## Generate synthetic VFR

If no real phone VFR clip is available, regenerate a tiny (~100KB) H.264 fixture:

```sh
./scripts/generate-vfr-fixture.sh
# overwrite: ./scripts/generate-vfr-fixture.sh --force
```

Writes `vfr-short.mp4` (~3s). True VFR via concat of 12/24/30/48 fps CFR segments (stream copy).

Verify irregular PTS:

```sh
ffprobe -v error -select_streams v:0 \
  -show_entries packet=pts_time,duration_time -of csv=p=0 \
  test-media/fixtures/vfr-short.mp4 | head
```

Expect mixed `duration_time` values (≈0.083 / 0.042 / 0.033 / 0.021 s) and `avg_frame_rate ≠ r_frame_rate`.
