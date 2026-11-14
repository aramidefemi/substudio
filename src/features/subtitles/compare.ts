import type { CueData } from "./types";

export type DiffKind = "same" | "changed" | "onlyLeft" | "onlyRight";

export interface CueDiffRow {
  index: number;
  kind: DiffKind;
  left: CueData | null;
  right: CueData | null;
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.001;

function cueEqual(a: CueData, b: CueData): boolean {
  return near(a.start, b.start) && near(a.end, b.end) && a.text === b.text;
}

/** Pair cues by index for a side-by-side compare (SE-style). */
export function compareCues(left: readonly CueData[], right: readonly CueData[]): CueDiffRow[] {
  const n = Math.max(left.length, right.length);
  const rows: CueDiffRow[] = [];
  for (let i = 0; i < n; i++) {
    const l = left[i] ?? null;
    const r = right[i] ?? null;
    let kind: DiffKind;
    if (l && r) kind = cueEqual(l, r) ? "same" : "changed";
    else if (l) kind = "onlyLeft";
    else kind = "onlyRight";
    rows.push({ index: i, kind, left: l, right: r });
  }
  return rows;
}

export function diffSummary(rows: readonly CueDiffRow[]) {
  let same = 0;
  let changed = 0;
  let onlyLeft = 0;
  let onlyRight = 0;
  for (const r of rows) {
    if (r.kind === "same") same += 1;
    else if (r.kind === "changed") changed += 1;
    else if (r.kind === "onlyLeft") onlyLeft += 1;
    else onlyRight += 1;
  }
  return { same, changed, onlyLeft, onlyRight, total: rows.length };
}
