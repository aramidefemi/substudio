import { useEffect } from "react";
import { refreshSpellLists, scheduleLiveSpellCheck, useSpell } from "@/features/spellcheck/store";
import { useSubtitles } from "@/features/subtitles/store";

/** Keeps live spell underlines in sync with cue text (QLT-03). */
export function useLiveSpellCheck() {
  const enabled = useSpell((s) => s.enabled);

  useEffect(() => {
    void refreshSpellLists();
  }, []);

  useEffect(() => {
    if (!enabled) {
      useSpell.setState({ liveIssues: [] });
      return;
    }
    const run = () => scheduleLiveSpellCheck(useSubtitles.getState().cues.map((c) => c.text));
    run();
    return useSubtitles.subscribe((s, prev) => {
      if (s.cues === prev.cues) return;
      run();
    });
  }, [enabled]);
}
