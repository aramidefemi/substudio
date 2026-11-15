import type { CustomTextPreset } from "./customText";

/** Built-in starters; user presets live in settings beside these. */
export const STARTER_PRESETS: CustomTextPreset[] = [
  {
    id: "starter-timed",
    name: "Timed list",
    extension: "txt",
    template: {
      header: "",
      body: "{start} --> {end}\n{text}\n\n",
      footer: "",
    },
  },
  {
    id: "starter-dialogue",
    name: "Dialogue only",
    extension: "txt",
    template: {
      header: "",
      body: "{text}\n\n",
      footer: "",
    },
  },
  {
    id: "starter-numbered",
    name: "Numbered lines",
    extension: "txt",
    template: {
      header: "",
      body: "{number}. {text}\n",
      footer: "",
    },
  },
  {
    id: "starter-csv",
    name: "CSV (number, start, end, text)",
    extension: "csv",
    template: {
      header: "Number,Start,End,Text\n",
      body: '{number},{start},{end},"{text}"\n',
      footer: "",
    },
  },
];

export function allPresets(saved: CustomTextPreset[]): CustomTextPreset[] {
  const savedIds = new Set(saved.map((p) => p.id));
  return [...STARTER_PRESETS.filter((p) => !savedIds.has(p.id)), ...saved];
}
