import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Ban, FileDown } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { inTauri } from "@/lib/tauri";
import { openDroppedFiles } from "./actions";
import { describeDrop, planDrop, type DropPlan } from "./drop";

/**
 * Drag a video or subtitle file onto the window to open it. Uses Tauri's
 * webview drag-drop event (real file paths), so it only works in the desktop app.
 */
export function DropOverlay() {
  const [plan, setPlan] = useState<DropPlan | null>(null);

  useEffect(() => {
    if (!inTauri) return;
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      const p = event.payload;
      if (p.type === "enter") setPlan(planDrop(p.paths));
      else if (p.type === "leave") setPlan(null);
      else if (p.type === "drop") {
        setPlan(null);
        if (p.paths.length) void openDroppedFiles(p.paths);
      }
    });
    return () => void unlisten.then((fn) => fn());
  }, []);

  if (!plan) return null;
  const ok = Boolean(plan.subtitle || plan.video);
  const Icon = ok ? FileDown : Ban;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6"
    >
      <div
        className={cn(
          "flex size-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed text-sm font-medium",
          ok ? "border-primary text-foreground" : "border-destructive text-destructive",
        )}
      >
        <Icon className="size-8" aria-hidden />
        <span>{describeDrop(plan)}</span>
      </div>
    </div>
  );
}
