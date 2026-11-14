import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BackupInfo } from "@/lib/tauri";
import { commands, inTauri } from "@/lib/tauri";
import { restoreBackup, useUi } from "./actions";

function formatWhen(ms: number) {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

/** File → Restore Auto-backup: pick a periodic backup to reload. */
export function RestoreBackupDialog() {
  const open = useUi((s) => s.backupOpen);
  const [items, setItems] = useState<BackupInfo[] | null>(null);

  const setOpen = (backupOpen: boolean) => {
    if (backupOpen) setItems(null);
    useUi.setState({ backupOpen });
  };

  useEffect(() => {
    if (!open || !inTauri) return;
    let cancelled = false;
    void commands
      .listAutoBackups()
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const loading = open && items === null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Restore auto-backup</DialogTitle>
          <DialogDescription>
            Periodic backups of unsaved work. Restoring marks the document dirty — save to keep.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto rounded-md border border-border">
          {loading && <p className="p-3 text-sm text-muted-foreground">Loading…</p>}
          {!loading && items?.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              No backups yet. They appear while you have unsaved edits.
            </p>
          )}
          <ul className="divide-y divide-border">
            {(items ?? []).map((b) => (
              <li key={b.path} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{b.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatWhen(b.modifiedMs)} · {Math.max(1, Math.round(b.size / 1024))} KB
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    void restoreBackup(b.path);
                  }}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
