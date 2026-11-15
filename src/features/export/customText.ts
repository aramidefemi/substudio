/** Pure custom-text export templates (FMT-03). Times stay seconds until formatTime. */

import { formatDuration, formatTime, type TimeFormat } from "@/features/subtitles/timecode";

export interface CueLike {
  start: number;
  end: number;
  text: string;
  style?: string;
}

export interface CustomTextTemplate {
  header: string;
  /** Rendered once per cue. */
  body: string;
  footer: string;
}

export interface CustomTextPreset {
  id: string;
  name: string;
  /** Suggested file extension without the dot. */
  extension: string;
  template: CustomTextTemplate;
}

const PLACEHOLDER = /\{([a-z0-9-]+)\}/gi;

function linesOf(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function cueFields(cue: CueLike, index: number, total: number, time: TimeFormat): Record<string, string> {
  const lines = linesOf(cue.text);
  const duration = Math.max(0, cue.end - cue.start);
  const fields: Record<string, string> = {
    number: String(index),
    index: String(index),
    total: String(total),
    start: formatTime(cue.start, time),
    end: formatTime(cue.end, time),
    duration: formatDuration(duration, time),
    "start-sec": cue.start.toFixed(3),
    "end-sec": cue.end.toFixed(3),
    "duration-sec": duration.toFixed(3),
    text: cue.text,
    style: cue.style ?? "",
    tab: "\t",
    newline: "\n",
    n: "\n",
  };
  for (let i = 0; i < lines.length; i++) {
    fields[`line${i + 1}`] = lines[i]!;
    fields[`text-line-${i + 1}`] = lines[i]!;
  }
  return fields;
}

function apply(template: string, fields: Record<string, string>): string {
  return template.replace(PLACEHOLDER, (raw, key: string) => {
    const k = key.toLowerCase();
    return Object.prototype.hasOwnProperty.call(fields, k) ? fields[k]! : raw;
  });
}

/** Renders header + each cue's body + footer. Unknown `{tokens}` are left intact. */
export function renderCustomText(cues: readonly CueLike[], template: CustomTextTemplate, time: TimeFormat): string {
  const total = cues.length;
  const headerFields: Record<string, string> = {
    total: String(total),
    number: "0",
    index: "0",
    tab: "\t",
    newline: "\n",
    n: "\n",
  };
  let out = apply(template.header, headerFields);
  for (let i = 0; i < cues.length; i++) {
    out += apply(template.body, cueFields(cues[i]!, i + 1, total, time));
  }
  out += apply(template.footer, headerFields);
  return out;
}

export function normalizePreset(raw: Partial<CustomTextPreset> | null | undefined, fallbackId: string): CustomTextPreset | null {
  if (!raw || typeof raw !== "object") return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const template = raw.template;
  if (!name || !template || typeof template !== "object") return null;
  const header = typeof template.header === "string" ? template.header : "";
  const body = typeof template.body === "string" ? template.body : "";
  const footer = typeof template.footer === "string" ? template.footer : "";
  if (!body) return null;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : fallbackId,
    name,
    extension: typeof raw.extension === "string" && raw.extension ? raw.extension.replace(/^\./, "") : "txt",
    template: { header, body, footer },
  };
}

export function normalizePresets(raw: unknown): CustomTextPreset[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p, i) => normalizePreset(p as Partial<CustomTextPreset>, `custom-${i}`))
    .filter((p): p is CustomTextPreset => !!p);
}
