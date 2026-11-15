import { useMemo, useState } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { type CustomTextPreset, renderCustomText } from "@/features/export/customText";
import { allPresets, STARTER_PRESETS } from "@/features/export/presets";
import { deleteCustomTextPreset, saveCustomTextPreset, useSettings } from "@/features/settings/store";
import { useSubtitles } from "@/features/subtitles/store";
import { commands, fileName, inTauri, stripExtension } from "@/lib/tauri";
import { useUi } from "./actions";

const newId = () => `custom-${crypto.randomUUID().slice(0, 8)}`;

/** File › Export custom text — template placeholders + preview + saved presets (FMT-03). */
export function CustomTextExportDialog() {
  const open = useUi((s) => s.customTextExportOpen);
  const cues = useSubtitles((s) => s.cues);
  const filePath = useSubtitles((s) => s.filePath);
  const videoPath = useSubtitles((s) => s.videoPath);
  const fps = useSubtitles((s) => s.fps);
  const timecode = useSubtitles((s) => s.timecode);
  const saved = useSettings((s) => s.customTextPresets);
  const presets = useMemo(() => allPresets(saved), [saved]);
  const [activeId, setActiveId] = useState(STARTER_PRESETS[0]!.id);
  const active = presets.find((p) => p.id === activeId) ?? presets[0]!;
  const isStarter = STARTER_PRESETS.some((p) => p.id === active.id);

  const [draft, setDraft] = useState<CustomTextPreset>(active);
  const syncActive = (id: string) => {
    const next = presets.find((p) => p.id === id) ?? presets[0]!;
    setActiveId(next.id);
    setDraft(next);
  };

  const time = useMemo(() => ({ mode: timecode, fps }), [timecode, fps]);
  const preview = useMemo(
    () => renderCustomText(cues.slice(0, 8), draft.template, time),
    [cues, draft.template, time],
  );
  const full = useMemo(() => renderCustomText(cues, draft.template, time), [cues, draft.template, time]);

  const patchTemplate = (key: "header" | "body" | "footer", value: string) =>
    setDraft((d) => ({ ...d, template: { ...d.template, [key]: value } }));

  const exportFile = async () => {
    if (!inTauri) {
      toast("Export in the desktop app", { description: "Run `pnpm tauri dev`." });
      return;
    }
    if (!draft.template.body.trim()) {
      toast.error("Body template is required");
      return;
    }
    const base = stripExtension(fileName(filePath ?? videoPath ?? "Untitled"));
    const path = await saveDialog({
      defaultPath: `${base}.${draft.extension || "txt"}`,
      filters: [{ name: "Custom text", extensions: [draft.extension || "txt", "txt"] }],
    });
    if (!path) return;
    try {
      await commands.writeTextFile(path, full);
      toast.success(`Exported ${cues.length} line${cues.length === 1 ? "" : "s"}`, {
        description: fileName(path),
      });
      useUi.setState({ customTextExportOpen: false });
    } catch (err) {
      toast.error("Could not export", { description: String(err) });
    }
  };

  const savePreset = () => {
    const name = draft.name.trim() || "Custom";
    const preset: CustomTextPreset = {
      ...draft,
      id: isStarter ? newId() : draft.id,
      name,
      extension: draft.extension.replace(/^\./, "") || "txt",
    };
    saveCustomTextPreset(preset);
    setActiveId(preset.id);
    setDraft(preset);
    toast.success("Preset saved");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        useUi.setState({ customTextExportOpen: v });
        if (v) syncActive(activeId);
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col gap-3 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Export custom text</DialogTitle>
          <DialogDescription>
            Placeholders: {"{number}"}, {"{start}"}, {"{end}"}, {"{duration}"}, {"{text}"}, {"{line1}"}, {"{style}"},{" "}
            {"{total}"}, {"{tab}"}, {"{newline}"}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <Toggle
              key={p.id}
              size="sm"
              variant="outline"
              pressed={active.id === p.id}
              onPressedChange={() => syncActive(p.id)}
              className="h-7 px-2 text-xs"
            >
              {p.name}
            </Toggle>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input
            className="h-8"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Preset name"
          />
          <Input
            className="h-8"
            value={draft.extension}
            onChange={(e) => setDraft((d) => ({ ...d, extension: e.target.value }))}
            placeholder="Extension"
          />
        </div>

        <label className="space-y-1 text-xs text-muted-foreground">
          Header
          <Textarea
            className="min-h-12 font-mono text-xs"
            value={draft.template.header}
            onChange={(e) => patchTemplate("header", e.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Body (per cue)
          <Textarea
            className="min-h-20 font-mono text-xs"
            value={draft.template.body}
            onChange={(e) => patchTemplate("body", e.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Footer
          <Textarea
            className="min-h-12 font-mono text-xs"
            value={draft.template.footer}
            onChange={(e) => patchTemplate("footer", e.target.value)}
          />
        </label>

        <label className="space-y-1 text-xs text-muted-foreground">
          Preview{cues.length > 8 ? " (first 8 cues)" : ""}
          <Textarea className="min-h-28 font-mono text-xs" readOnly value={preview} />
        </label>

        <div className="flex flex-wrap justify-end gap-2">
          {!isStarter && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                deleteCustomTextPreset(active.id);
                syncActive(STARTER_PRESETS[0]!.id);
              }}
            >
              Delete preset
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={savePreset}>
            {isStarter ? "Save as preset" : "Save preset"}
          </Button>
          <Button size="sm" onClick={() => void exportFile()} disabled={!cues.length}>
            Export…
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
