import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useSettings } from "@/features/settings/store";
import { fileName } from "@/lib/tauri";
import { openRecentSubtitle, openRecentVideo, useUi } from "./actions";

/** File → Open Recent: jump to a recent subtitle or video. */
export function RecentDialog() {
  const open = useUi((s) => s.recentOpen);
  const subtitles = useSettings((s) => s.recentSubtitles);
  const videos = useSettings((s) => s.recentVideos);
  const setOpen = (recentOpen: boolean) => useUi.setState({ recentOpen });

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Recent files" description="Open a recent subtitle or video">
      <CommandInput placeholder="Filter recent files…" />
      <CommandList>
        <CommandEmpty>No recent files.</CommandEmpty>
        {open && subtitles.length > 0 && (
          <CommandGroup heading="Subtitles">
            {subtitles.map((entry) => (
              <CommandItem
                key={entry.path}
                value={`sub ${fileName(entry.path)} ${entry.path}`}
                onSelect={() => {
                  void openRecentSubtitle(entry.path, entry.videoPath);
                  setOpen(false);
                }}
              >
                <span className="truncate">{fileName(entry.path)}</span>
                <span className="ml-auto max-w-[40%] truncate text-xs text-muted-foreground">{entry.path}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {open && videos.length > 0 && (
          <CommandGroup heading="Videos">
            {videos.map((path) => (
              <CommandItem
                key={path}
                value={`vid ${fileName(path)} ${path}`}
                onSelect={() => {
                  void openRecentVideo(path);
                  setOpen(false);
                }}
              >
                <span className="truncate">{fileName(path)}</span>
                <span className="ml-auto max-w-[40%] truncate text-xs text-muted-foreground">{path}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
