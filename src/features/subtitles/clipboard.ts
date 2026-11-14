import type { CueData } from "./types";

const HEADER = "WEBVTT-SUBSTUDIO-CUES";

function srtTime(t: number): string {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const frac = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(frac).padStart(3, "0")}`;
}

function parseSrtTime(raw: string): number | null {
  const m = raw.trim().match(/^(\d+):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (!m) return null;
  const ms = (m[4] + "000").slice(0, 3);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(ms) / 1000;
}

/** Serialize cues for the system clipboard (SRT-like, with a marker header). */
export function serializeCues(cues: readonly CueData[]): string {
  const body = cues
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}`)
    .join("\n\n");
  return `${HEADER}\n\n${body}`;
}

/** Parse clipboard text into cues. Accepts our marker format or plain SRT blocks. */
export function parseCues(raw: string): CueData[] | null {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return null;
  const body = text.startsWith(HEADER) ? text.slice(HEADER.length).trim() : text;
  const blocks = body.split(/\n\s*\n/);
  const cues: CueData[] = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((l, i) => !(i === 0 && /^\d+$/.test(l.trim())));
    if (!lines.length) continue;
    const timing = lines[0]!.match(/^(.+?)\s+-->\s+(.+)$/);
    if (!timing) continue;
    const start = parseSrtTime(timing[1]!);
    const end = parseSrtTime(timing[2]!.split(/\s+/)[0]!);
    if (start === null || end === null || end <= start) continue;
    cues.push({ start, end, text: lines.slice(1).join("\n") });
  }
  return cues.length ? cues : null;
}
