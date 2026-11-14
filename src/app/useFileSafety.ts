import { useEffect, useRef } from "react";
import { useSettings } from "@/features/settings/store";
import { getKnownMtime, setKnownMtime, useSubtitles } from "@/features/subtitles/store";
import { commands, inTauri } from "@/lib/tauri";
import { onExternalFileChange, openBackupDialog, runAutoBackup } from "./actions";

const WATCH_MS = 2500;

/** External change detection + periodic auto-backup. Keeps timers out of React render. */
export function useFileSafety() {
  const prompting = useRef(false);

  // Poll mtime of the open subtitle file.
  useEffect(() => {
    if (!inTauri) return;
    const id = window.setInterval(() => {
      const { filePath } = useSubtitles.getState();
      const known = getKnownMtime();
      if (!filePath || known == null || prompting.current) return;
      void commands
        .fileMtime(filePath)
        .then(async (ms) => {
          if (ms === known || prompting.current) return;
          prompting.current = true;
          try {
            await onExternalFileChange();
          } finally {
            prompting.current = false;
          }
        })
        .catch(() => undefined);
    }, WATCH_MS);
    return () => clearInterval(id);
  }, []);

  // Auto-backup while dirty.
  useEffect(() => {
    if (!inTauri) return;
    let timer: number | undefined;
    const arm = () => {
      if (timer) clearInterval(timer);
      const sec = useSettings.getState().autoBackupIntervalSec;
      timer = window.setInterval(() => void runAutoBackup(), Math.max(15, sec) * 1000);
    };
    arm();
    const unsub = useSettings.subscribe((s, prev) => {
      if (s.autoBackupIntervalSec !== prev.autoBackupIntervalSec) arm();
    });
    return () => {
      if (timer) clearInterval(timer);
      unsub();
    };
  }, []);

  // Offer restore if backups exist on launch (once).
  useEffect(() => {
    if (!inTauri) return;
    let cancelled = false;
    void commands
      .listAutoBackups()
      .then((list) => {
        if (cancelled || !list.length) return;
        // Only nudge when starting with the sample/untitled doc and no path.
        const { filePath, dirty } = useSubtitles.getState();
        if (filePath || dirty) return;
        const newest = list[0]!;
        const dayMs = 24 * 60 * 60 * 1000;
        if (Date.now() - newest.modifiedMs > dayMs) return;
        import("sonner").then(({ toast }) => {
          toast("Auto-backup available", {
            description: newest.label,
            action: { label: "Restore…", onClick: () => openBackupDialog() },
            duration: 12_000,
          });
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset known mtime when the open path changes without going through open helpers.
  useEffect(
    () =>
      useSubtitles.subscribe((s, prev) => {
        if (s.filePath !== prev.filePath && !s.filePath) setKnownMtime(null);
      }),
    [],
  );
}
