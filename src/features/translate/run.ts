import { create } from "zustand";
import { setShowOriginalColumn } from "@/features/settings/store";
import { getRules } from "@/features/subtitles/activeRules";
import { applyMachineTranslations, seedOriginalsFromText, useSubtitles } from "@/features/subtitles/store";
import { commands, inTauri } from "@/lib/tauri";
import type { TranslateEngine } from "./languages";
import { BATCH_LIMITS, buildPlan, chunk, finish, type PlanOptions } from "./plan";

/**
 * Runs one auto-translate pass (TRN-01): plan → batches → Rust → document.
 * Each batch lands in the subtitle list as soon as it arrives. The whole pass is
 * one undo step. Stopping or an error keeps what already arrived.
 */

export type RunPhase = "idle" | "running" | "done" | "stopped" | "error";

export interface RunState {
  phase: RunPhase;
  /** Lines finished so far / lines to translate. */
  done: number;
  total: number;
  /** In-scope lines left alone (blank, music only, already translated). */
  skipped: number;
  error: string | null;
  /** First line translated in this pass, for jumping to it afterwards. */
  firstId: string | null;
}

const IDLE: RunState = { phase: "idle", done: 0, total: 0, skipped: 0, error: null, firstId: null };

export const useTranslateRun = create<RunState>(() => IDLE);

export interface RunRequest extends PlanOptions {
  engine: TranslateEngine;
  apiKey: string;
  source: string;
  target: string;
}

let runSeq = 0;
let stopRequested = false;

/** Pause between free-endpoint batches, so Google is less likely to rate-limit us. */
const FREE_PAUSE_MS = 250;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const isRunning = () => useTranslateRun.getState().phase === "running";

export function stopTranslation() {
  if (isRunning()) stopRequested = true;
}

export function resetTranslation() {
  if (!isRunning()) useTranslateRun.setState(IDLE);
}

/** Resolves with the final state. Never throws. */
export async function runTranslation(req: RunRequest): Promise<RunState> {
  if (isRunning()) return useTranslateRun.getState();
  const plan = buildPlan(useSubtitles.getState().cues, req);
  const total = plan.items.length;
  stopRequested = false;
  useTranslateRun.setState({ ...IDLE, phase: total ? "running" : "done", total, skipped: plan.skipped });
  if (!total) return useTranslateRun.getState();

  if (!inTauri) {
    useTranslateRun.setState({ phase: "error", error: "Auto-translate runs in the desktop app (pnpm app)." });
    return useTranslateRun.getState();
  }

  const key = `translate:${++runSeq}`;
  const maxLen = getRules().maxLineLength;
  let seeded = !plan.seedOriginals;
  let done = 0;
  let firstId: string | null = null;

  try {
    const batches = chunk(plan.items, BATCH_LIMITS[req.engine]);
    for (let b = 0; b < batches.length; b++) {
      if (stopRequested) break;
      const batch = batches[b]!;
      const out = await commands.translateTexts(
        req.engine,
        req.engine === "google-cloud" ? req.apiKey : null,
        req.source,
        req.target,
        batch.map((i) => i.send),
      );
      // Seed the original column only once Google has answered, so a failed
      // first request leaves the document untouched.
      if (!seeded) {
        seedOriginalsFromText(key);
        setShowOriginalColumn(true);
        seeded = true;
      }
      // Lines deleted meanwhile are simply not found.
      const texts = new Map<string, string>();
      batch.forEach((item, i) => {
        const text = finish(item, out[i] ?? "", maxLen);
        if (text) texts.set(item.id, text);
      });
      applyMachineTranslations(texts, key);
      firstId ??= batch[0]!.id;
      done += batch.length;
      useTranslateRun.setState({ done, firstId });
      if (req.engine === "google-free" && b < batches.length - 1) await sleep(FREE_PAUSE_MS);
    }
    useTranslateRun.setState({ phase: stopRequested ? "stopped" : "done" });
  } catch (err) {
    useTranslateRun.setState({ phase: "error", error: String(err).replace(/^Error:\s*/, "") });
  }
  stopRequested = false;
  return useTranslateRun.getState();
}
