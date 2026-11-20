import {
  Clapperboard,
  FileDown,
  FilePlus2,
  FolderOpen,
  Languages,
  Redo2,
  Save,
  Search,
  Settings2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  setDensity,
  setPreview,
  // setShowCpsColumn,
  setShowFormattingInGrid,
  // setShowGapColumn,
  setShowOriginalColumn,
  setTheme,
  useSettings,
  type Density,
} from "@/features/settings/store";
import {
  PREVIEW_BACKGROUNDS,
  PREVIEW_POSITIONS,
  PREVIEW_SIZES,
  type PreviewBackground,
  type PreviewPosition,
  type PreviewSize,
} from "@/features/settings/preview";
import { THEMES, type ThemePreference } from "@/features/settings/themes";
import { useActiveProfile, useRules } from "@/features/subtitles/activeRules";
import { listIssues } from "@/features/subtitles/rules";
import { useSubtitles } from "@/features/subtitles/store";
import type { TimecodeMode } from "@/features/subtitles/timecode";
import { useUi } from "./actions";
import { commandTitle, runCommand } from "./commands/registry";

/** Icon button bound to a registry command; the tooltip shows its shortcut. */
function ToolButton({ command, label, disabled, children }: { command: string; label?: string; disabled?: boolean; children: React.ReactNode }) {
  const title = commandTitle(command, label);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label={title}
          disabled={disabled}
          onClick={() => runCommand(command)}
          className="[&_svg]:size-[18px]"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

/** Live problem count; opens the errors list. The icon and number carry the signal, not colour. */
function ErrorsButton() {
  const rules = useRules();
  const profile = useActiveProfile();
  const count = useSubtitles((s) => listIssues(s.cues, rules).length);
  const open = useUi((s) => s.errorsOpen);
  const summary = count ? `${count} problem${count === 1 ? "" : "s"}` : "No problems";
  const title = commandTitle("view.errors", `${summary} (${profile.name}): list errors`);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          aria-label={title}
          aria-pressed={open}
          onClick={() => runCommand("view.errors")}
          className="gap-1 px-2 tabular-nums [&_svg]:size-[18px]"
        >
          <TriangleAlert className={count ? "text-destructive" : undefined} />
          <span className="text-xs">{count}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

/** Thin rule between toolbar groups. */
function Divider() {
  return <div aria-hidden className="mx-1 h-5 w-px bg-border" />;
}

export function Toolbar() {
  const canUndo = useSubtitles((s) => s.past.length > 0);
  const canRedo = useSubtitles((s) => s.future.length > 0);
  const timecode = useSubtitles((s) => s.timecode);
  const theme = useSettings((s) => s.theme);
  const density = useSettings((s) => s.density);
  // const showCps = useSettings((s) => s.showCpsColumn);
  // const showGap = useSettings((s) => s.showGapColumn);
  const showOriginal = useSettings((s) => s.showOriginalColumn);
  const showFormatting = useSettings((s) => s.showFormattingInGrid);
  const privacy = useSettings((s) => s.privacy);
  const preview = useSettings((s) => s.preview);

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b bg-background px-3">
      <ToolButton command="file.new">
        <FilePlus2 />
      </ToolButton>
      <ToolButton command="file.open">
        <FolderOpen />
      </ToolButton>
      <ToolButton command="file.openVideo">
        <Clapperboard />
      </ToolButton>
      <ToolButton command="file.save">
        <Save />
      </ToolButton>
      <Divider />
      <ToolButton command="edit.find">
        <Search />
      </ToolButton>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="View settings" className="[&_svg]:size-[18px]">
                <Settings2 />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>View settings</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePreference)}>
            <DropdownMenuRadioItem value="system">Match system</DropdownMenuRadioItem>
            {THEMES.map((t) => (
              <DropdownMenuRadioItem key={t.id} value={t.id}>
                {t.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Row density</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={density} onValueChange={(v) => setDensity(v as Density)}>
            <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Columns</DropdownMenuLabel>
          {/* <DropdownMenuCheckboxItem checked={showCps} onCheckedChange={(v) => setShowCpsColumn(v === true)}>
            CPS
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={showGap} onCheckedChange={(v) => setShowGapColumn(v === true)}>
            Gap
          </DropdownMenuCheckboxItem> */}
          <DropdownMenuCheckboxItem
            checked={showOriginal}
            onCheckedChange={(v) => setShowOriginalColumn(v === true)}
          >
            Original
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={showFormatting}
            onCheckedChange={(v) => setShowFormattingInGrid(v === true)}
          >
            Show formatting
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Timecode</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={timecode}
            onValueChange={(v) => useSubtitles.setState({ timecode: v as TimecodeMode })}
          >
            <DropdownMenuRadioItem value="frames">Frames (hh:mm:ss:ff)</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="ms">Milliseconds (hh:mm:ss,mmm)</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Subtitle preview</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              <DropdownMenuLabel>Text size</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={preview.size} onValueChange={(v) => setPreview({ size: v as PreviewSize })}>
                {PREVIEW_SIZES.map((o) => (
                  <DropdownMenuRadioItem key={o.id} value={o.id}>
                    {o.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Style</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={preview.background}
                onValueChange={(v) => setPreview({ background: v as PreviewBackground })}
              >
                {PREVIEW_BACKGROUNDS.map((o) => (
                  <DropdownMenuRadioItem key={o.id} value={o.id}>
                    {o.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Position</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={preview.position}
                onValueChange={(v) => setPreview({ position: v as PreviewPosition })}
              >
                {PREVIEW_POSITIONS.map((o) => (
                  <DropdownMenuRadioItem key={o.id} value={o.id}>
                    {o.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => runCommand("tools.shortcuts")}>Keyboard shortcuts…</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => runCommand("view.privacy")}>
            Screen privacy{privacy !== "off" ? ` (${privacy})` : ""}…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolButton command="translate.auto">
        <Languages />
      </ToolButton>

      <div className="flex-1" />

      <ErrorsButton />
      <Divider />
      <ToolButton command="edit.undo" disabled={!canUndo}>
        <Undo2 />
      </ToolButton>
      <ToolButton command="edit.redo" disabled={!canRedo}>
        <Redo2 />
      </ToolButton>
      <Divider />
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Export as…" className="[&_svg]:size-[18px]">
                <FileDown />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Export as…</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => runCommand("file.saveAs")}>SubRip (.srt)</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => runCommand("file.saveAsVtt")}>WebVTT (.vtt)</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => runCommand("file.saveAsAss")}>ASS (.ass)</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => runCommand("file.saveAsSsa")}>SSA (.ssa)</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => runCommand("file.saveAsSbv")}>YouTube SBV (.sbv)</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => runCommand("file.saveAsTtml")}>TTML (.ttml)</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => runCommand("file.saveAsDfxp")}>DFXP (.dfxp)</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => runCommand("file.customTextExport")}>Custom text…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
