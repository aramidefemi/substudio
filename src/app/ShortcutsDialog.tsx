import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { overrideCommandKeys, sePresetOverrides } from "@/app/commands/bindings";
import { bindingFromEvent, formatShortcut } from "@/app/commands/keys";
import { allCommands, getDefaultKeys } from "@/app/commands/registry";
import { setShortcutsSuppressed } from "@/app/commands/shortcuts";
import { resetShortcuts, setShortcutOverrides, useSettings } from "@/features/settings/store";
import { cn } from "@/lib/utils";
import { useUi } from "./actions";

function setCapturingId(id: string | null, setCapturing: (id: string | null) => void) {
  setShortcutsSuppressed(id !== null);
  setCapturing(id);
}

function effectiveKeys(id: string, overrides: Record<string, string[]>): string[] {
  return Object.hasOwn(overrides, id) ? overrides[id]! : (getDefaultKeys(id) ?? []);
}

function ShortcutRow({
  id,
  label,
  keys,
  capturing,
  onCapture,
}: {
  id: string;
  label: string;
  keys: string[];
  capturing: boolean;
  onCapture: (id: string | null) => void;
}) {
  const display = keys[0] ? formatShortcut(keys[0]) : "None";
  return (
    <div className="flex items-center gap-3 border-b border-border px-1 py-1.5 last:border-0">
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <button
        type="button"
        className={cn(
          "h-7 min-w-28 shrink-0 rounded-md border px-2 font-mono text-xs tabular-nums",
          capturing
            ? "border-primary bg-accent text-foreground"
            : "border-input bg-background text-muted-foreground hover:bg-muted",
        )}
        aria-label={`Shortcut for ${label}`}
        onClick={() => onCapture(capturing ? null : id)}
        onBlur={() => capturing && onCapture(null)}
        onKeyDown={(e) => {
          if (!capturing) return;
          e.preventDefault();
          e.stopPropagation();
          if (e.key === "Escape") {
            onCapture(null);
            return;
          }
          if (e.key === "Backspace" || e.key === "Delete") {
            setShortcutOverrides(overrideCommandKeys(useSettings.getState().shortcutOverrides, id, []));
            onCapture(null);
            return;
          }
          const binding = bindingFromEvent(e.nativeEvent);
          if (!binding) return;
          setShortcutOverrides(overrideCommandKeys(useSettings.getState().shortcutOverrides, id, [binding]));
          onCapture(null);
        }}
      >
        {capturing ? "Press keys…" : display}
      </button>
    </div>
  );
}

/** EDT-08: view / edit shortcuts, apply SE preset, reset to Substudio defaults. */
export function ShortcutsDialog() {
  const open = useUi((s) => s.shortcutsOpen);
  const overrides = useSettings((s) => s.shortcutOverrides);
  const [query, setQuery] = useState("");
  const [capturing, setCapturing] = useState<string | null>(null);
  const capture = (id: string | null) => setCapturingId(id, setCapturing);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, { id: string; label: string; keys: string[] }[]>();
    for (const c of allCommands()) {
      if (c.hidden) continue;
      if (q && !c.label.toLowerCase().includes(q) && !c.group.toLowerCase().includes(q) && !c.id.includes(q)) {
        continue;
      }
      const list = map.get(c.group) ?? [];
      list.push({ id: c.id, label: c.label, keys: effectiveKeys(c.id, overrides) });
      map.set(c.group, list);
    }
    return [...map.entries()];
  }, [overrides, query]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        useUi.setState({ shortcutsOpen: o });
        if (!o) {
          capture(null);
          setQuery("");
        }
      }}
    >
      <DialogContent className="flex max-h-[min(80vh,640px)] flex-col gap-3 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Click a shortcut, then press the new keys. Backspace clears. Escape cancels.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setShortcutOverrides(sePresetOverrides());
              capture(null);
              toast.success("Applied Subtitle Edit defaults");
            }}
          >
            Import Subtitle Edit defaults
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              resetShortcuts();
              capture(null);
              toast.success("Reset to Substudio defaults");
            }}
          >
            Reset to Substudio defaults
          </Button>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter commands…"
          aria-label="Filter commands"
        />
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border">
          {groups.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No matching commands.</p>
          ) : (
            groups.map(([group, rows]) => (
              <section key={group} className="px-2 py-2">
                <h3 className="sticky top-0 z-10 bg-card px-1 py-1 text-xs font-semibold text-muted-foreground">
                  {group}
                </h3>
                {rows.map((row) => (
                  <ShortcutRow
                    key={row.id}
                    id={row.id}
                    label={row.label}
                    keys={row.keys}
                    capturing={capturing === row.id}
                    onCapture={capture}
                  />
                ))}
              </section>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
