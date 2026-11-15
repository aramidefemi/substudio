import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMedia } from "@/features/media/store";
import { useSubtitles } from "@/features/subtitles/store";
import type { MediaInfo } from "@/lib/tauri";
import { useUi } from "./actions";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all tabular-nums">{value}</span>
    </div>
  );
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtDur(s: number | null) {
  if (s == null || !Number.isFinite(s)) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtStart(s: number | null) {
  if (s == null || !Number.isFinite(s)) return "—";
  if (Math.abs(s) < 1e-6) return "0";
  return `${s.toFixed(3)} s`;
}

function frameRateLabel(info: MediaInfo) {
  const base = info.frameRate ?? (info.fps != null ? String(info.fps) : "—");
  if (info.variableFrameRate) return `${base} (VFR)`;
  if (info.variableFrameRate === false) return `${base} (CFR)`;
  return base;
}

/** Tools → Media Information: container / codec / tracks for the open video. */
export function MediaInfoDialog() {
  const open = useUi((s) => s.mediaInfoOpen);
  const videoPath = useSubtitles((s) => s.videoPath);
  const info = useMedia((s) => s.info);
  const frameTimes = useMedia((s) => s.frameTimes);
  const loading = useMedia((s) => s.loading);
  const error = useMedia((s) => s.error);

  return (
    <Dialog open={open} onOpenChange={(mediaInfoOpen) => useUi.setState({ mediaInfoOpen })}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Media information</DialogTitle>
          <DialogDescription>Local probe only — nothing leaves this machine.</DialogDescription>
        </DialogHeader>
        {!videoPath && <p className="text-sm text-muted-foreground">Open a video first.</p>}
        {videoPath && error && <p className="text-sm text-destructive">{error}</p>}
        {videoPath && !error && loading && !info && (
          <p className="text-sm text-muted-foreground">Probing…</p>
        )}
        {info && (
          <div className="max-h-96 space-y-3 overflow-y-auto">
            <Row label="File" value={info.fileName} />
            <Row label="Path" value={info.path} />
            <Row label="Size" value={fmtBytes(info.sizeBytes)} />
            <Row label="Container" value={info.container ?? "—"} />
            <Row label="Duration" value={fmtDur(info.durationSecs)} />
            <Row label="Start offset" value={fmtStart(info.startTimeSecs)} />
            <Row
              label="Resolution"
              value={info.width && info.height ? `${info.width}×${info.height}` : "—"}
            />
            <Row label="Frame rate" value={frameRateLabel(info)} />
            <Row
              label="Frames"
              value={
                frameTimes?.length
                  ? String(frameTimes.length)
                  : info.frameCount != null
                    ? String(info.frameCount)
                    : "—"
              }
            />
            <Row
              label="Bit rate"
              value={info.bitRate ? `${Math.round(info.bitRate / 1000)} kb/s` : "—"}
            />
            <Row label="Source" value={info.source} />
            {info.note && <p className="text-xs text-muted-foreground">{info.note}</p>}
            {info.tracks.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold">Tracks</div>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {info.tracks.map((t) => (
                    <li key={`${t.index}-${t.kind}`} className="px-3 py-2 text-sm">
                      <div className="font-medium">
                        #{t.index} {t.kind}
                        {t.codec ? ` · ${t.codec}` : ""}
                        {t.language ? ` · ${t.language}` : ""}
                      </div>
                      {t.detail && <div className="text-xs text-muted-foreground">{t.detail}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
