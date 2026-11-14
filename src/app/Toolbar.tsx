import { ChevronDown, Clapperboard, FilePlus2, FolderOpen, Redo2, Save, Search, Settings2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { setDensity, setTheme, useSettings, type Density } from "@/features/settings/store";
import { THEMES, type ThemePreference } from "@/features/settings/themes";
import { useSubtitles } from "@/features/subtitles/store";
import type { TimecodeMode } from "@/features/subtitles/timecode";
import { fileName } from "@/lib/tauri";
import { newFile, openFind, openSubtitles, openVideo, redoAction, save, saveAs, undoAction } from "./actions";

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={label} onClick={onClick} className="[&_svg]:size-[18px]">
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function Toolbar() {
  const filePath = useSubtitles((s) => s.filePath);
  const dirty = useSubtitles((s) => s.dirty);
  const canUndo = useSubtitles((s) => s.past.length > 0);
  const canRedo = useSubtitles((s) => s.future.length > 0);
  const timecode = useSubtitles((s) => s.timecode);
  const theme = useSettings((s) => s.theme);
  const density = useSettings((s) => s.density);

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b bg-background px-3">
      <ToolButton label="New (⌘N)" onClick={() => void newFile()}>
        <FilePlus2 />
      </ToolButton>
      <ToolButton label="Open subtitles (⌘O)" onClick={() => void openSubtitles()}>
        <FolderOpen />
      </ToolButton>
      <ToolButton label="Open video (⇧⌘O)" onClick={() => void openVideo()}>
        <Clapperboard />
      </ToolButton>
      <ToolButton label="Save (⌘S)" onClick={() => void save()}>
        <Save />
      </ToolButton>
      <Separator orientation="vertical" className="mx-1.5 h-6" />
      <ToolButton label="Find (⌘F)" onClick={openFind}>
        <Search />
      </ToolButton>
      <Separator orientation="vertical" className="mx-1.5 h-6" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Undo (⌘Z)" disabled={!canUndo} onClick={undoAction} className="[&_svg]:size-[18px]">
            <Undo2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Undo (⌘Z)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Redo (⇧⌘Z)" disabled={!canRedo} onClick={redoAction} className="[&_svg]:size-[18px]">
            <Redo2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Redo (⇧⌘Z)</TooltipContent>
      </Tooltip>
      <Separator orientation="vertical" className="mx-1.5 h-6" />

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
          <DropdownMenuLabel>Timecode</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={timecode}
            onValueChange={(v) => useSubtitles.setState({ timecode: v as TimecodeMode })}
          >
            <DropdownMenuRadioItem value="frames">Frames (hh:mm:ss:ff)</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="ms">Milliseconds (hh:mm:ss,mmm)</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />

      <span className="mr-3 max-w-[30vw] truncate text-sm text-muted-foreground">
        {filePath ? fileName(filePath) : "Untitled"}
        {dirty && <span aria-label="Unsaved changes" className="ml-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" />}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            Export <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void saveAs("srt")}>SubRip (.srt)</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void saveAs("vtt")}>WebVTT (.vtt)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
