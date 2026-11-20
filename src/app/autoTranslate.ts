import { toast } from "sonner";
import { create } from "zustand";
import { useSettings } from "@/features/settings/store";
import { acceptMachineTranslations, select, selectRelative, undo, useSubtitles } from "@/features/subtitles/store";
import { languageName } from "@/features/translate/languages";
import { isRunning, type RunState } from "@/features/translate/run";
import { getCommand } from "./commands/registry";
import { formatShortcut } from "./commands/keys";

/**
 * Auto-translate UI glue (TRN-01): the dialog's open state, the "no prompt"
 * repeat, and the review loop (accept and go to the next machine translation).
 */

export type TranslateScope = "all" | "selected";

export const useTranslateUi = create<{ open: boolean; scope: TranslateScope; autoStart: boolean }>(() => ({
  open: false,
  scope: "all",
  autoStart: false,
}));

const pluralLines = (n: number) => `${n} line${n === 1 ? "" : "s"}`;

function shortcutOf(id: string): string | null {
  const key = getCommand(id)?.keys?.[0];
  return key ? formatShortcut(key) : null;
}

/** Translate › Auto-translate… */
export function openAutoTranslate() {
  if (isRunning()) return useTranslateUi.setState({ open: true });
  const s = useSubtitles.getState();
  if (!s.cues.length) {
    toast("Nothing to translate yet", { description: "Open a subtitle file or paste the script first." });
    return;
  }
  useTranslateUi.setState({ open: true, autoStart: false, scope: s.selectedIds.length > 1 ? "selected" : "all" });
}

/** Translate › Translate selected lines (last settings): skips the dialog once it has been used. */
export function translateSelectedNoPrompt() {
  const s = useSubtitles.getState();
  if (!s.selectedIds.length) {
    toast("Select the lines to translate first");
    return;
  }
  const used = useSettings.getState().translate.used;
  useTranslateUi.setState({ open: true, scope: "selected", autoStart: used && !isRunning() });
}

/** Toast once a pass ends; the dialog closes itself on success. */
export function announceResult(r: RunState) {
  const { source, target } = useSettings.getState().translate;
  const pair = `${languageName(source)} → ${languageName(target)}`;
  if (r.phase === "done" && r.total === 0) {
    toast("Nothing to translate", {
      description: r.skipped ? `${pluralLines(r.skipped)} already translated, blank or music only.` : undefined,
    });
    return;
  }
  if (r.firstId) select(r.firstId);
  const accept = shortcutOf("translate.acceptNext");
  const review = `Lines are marked as machine translation until you edit them${accept ? ` or press ${accept} to accept` : ""}.`;
  const title =
    r.phase === "stopped" ? `Stopped after ${pluralLines(r.done)}` : `Translated ${pluralLines(r.done)} · ${pair}`;
  toast.success(title, {
    description: review,
    duration: 8000,
    action: r.done ? { label: "Undo", onClick: () => undo() } : undefined,
  });
}

/* ---------- review loop ---------- */

function nextMachineIndex(from: number, dir: 1 | -1): number {
  const cues = useSubtitles.getState().cues;
  for (let i = from + dir; i >= 0 && i < cues.length; i += dir) if (cues[i]!.mt) return i;
  return -1;
}

const allReviewed = () =>
  toast("No machine translations left to review", { description: "Every translated line has been edited or accepted." });

/** Go to the next (or previous) line still marked as machine translation. */
export function goToMachineTranslation(dir: 1 | -1) {
  const s = useSubtitles.getState();
  const at = s.cues.findIndex((c) => c.id === s.selectedId);
  let i = nextMachineIndex(at < 0 ? (dir > 0 ? -1 : s.cues.length) : at, dir);
  // Wrap once, like Find next.
  if (i < 0) i = nextMachineIndex(dir > 0 ? -1 : s.cues.length, dir);
  if (i < 0 || i === at) return allReviewed();
  select(s.cues[i]!.id);
}

/**
 * ⌘↩, like "confirm segment" in translation tools: accept the selected machine
 * translation(s) as they are and move to the next line. On a line she wrote
 * herself it simply moves on.
 */
export function acceptAndNext() {
  const s = useSubtitles.getState();
  const accepted = s.cues.filter((c) => c.mt && s.selectedIds.includes(c.id));
  if (accepted.length) acceptMachineTranslations(accepted.map((c) => c.id));
  selectRelative(1);
}

/** Accept every machine translation in the document at once. One undo step. */
export function acceptAllMachineTranslations() {
  const ids = useSubtitles.getState().cues.filter((c) => c.mt).map((c) => c.id);
  if (!ids.length) return allReviewed();
  acceptMachineTranslations(ids);
  toast.success(`Accepted ${pluralLines(ids.length)}`, { action: { label: "Undo", onClick: () => undo() } });
}
