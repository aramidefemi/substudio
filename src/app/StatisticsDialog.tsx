import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { computeStats, cpsHistogram } from "@/features/subtitles/stats";
import { selectedCues, useSubtitles } from "@/features/subtitles/store";
import { useUi } from "./actions";

function fmtSecs(s: number) {
  if (!Number.isFinite(s)) return "—";
  return `${s.toFixed(2)} s`;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function StatsBlock({ title, cues }: { title: string; cues: ReturnType<typeof selectedCues> }) {
  const s = computeStats(cues);
  const hist = cpsHistogram(cues);
  const maxCount = Math.max(1, ...hist.map((b) => b.count));
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="space-y-1.5">
        <StatRow label="Lines" value={String(s.lines)} />
        <StatRow label="Characters" value={String(s.chars)} />
        <StatRow label="Words" value={String(s.words)} />
        <StatRow label="Total duration" value={fmtSecs(s.totalDuration)} />
        <StatRow label="Avg duration" value={fmtSecs(s.avgDuration)} />
        <StatRow label="Avg CPS" value={s.avgCps.toFixed(1)} />
        <StatRow label="Max CPS" value={s.maxCps.toFixed(1)} />
        <StatRow label="Min gap" value={s.minGap === null ? "—" : fmtSecs(s.minGap)} />
        <StatRow label="Overlaps" value={String(s.overlaps)} />
      </div>
      <div>
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">CPS histogram</div>
        <div className="space-y-1">
          {hist.map((b) => (
            <div key={b.label} className="flex items-center gap-2 text-xs">
              <span className="w-12 shrink-0 tabular-nums text-muted-foreground">{b.label}</span>
              <div className="h-2 min-w-0 flex-1 rounded-sm bg-muted">
                <div
                  className="h-full rounded-sm bg-primary/70"
                  style={{ width: `${(b.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right tabular-nums">{b.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Tools → Statistics: file + selection KPIs and CPS histogram. */
export function StatisticsDialog() {
  const open = useUi((s) => s.statsOpen);
  const cues = useSubtitles((s) => s.cues);
  const selectedIds = useSubtitles((s) => s.selectedIds);
  const selected = cues.filter((c) => selectedIds.includes(c.id));
  const setOpen = (statsOpen: boolean) => useUi.setState({ statsOpen });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Statistics</DialogTitle>
          <DialogDescription>Totals for the whole file and the current selection.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          <StatsBlock title="Entire file" cues={cues} />
          <StatsBlock title={`Selected (${selected.length})`} cues={selected} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
