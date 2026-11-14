import { Bookmark } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { clock } from "@/features/playback/clock";
import { useSettings } from "@/features/settings/store";
import { isBookmarked } from "@/features/subtitles/bookmarks";
import { select, selectTimeFormat, useSubtitles } from "@/features/subtitles/store";
import { formatTime } from "@/features/subtitles/timecode";
import { useUi } from "./actions";

/** Edit › Bookmarks › List: every bookmarked line with its note; search notes and text, Enter jumps. */
export function BookmarksDialog() {
  const open = useUi((s) => s.bookmarksOpen);
  const cues = useSubtitles((s) => s.cues);
  const hideText = useSettings((s) => s.privacy) === "text";
  const setOpen = (bookmarksOpen: boolean) => useUi.setState({ bookmarksOpen });
  const marked = open ? cues.flatMap((cue, index) => (isBookmarked(cue) ? [{ cue, index }] : [])) : [];

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Bookmarks" description="Jump to a bookmarked subtitle">
      <CommandInput placeholder="Search bookmarks…" />
      <CommandList>
        <CommandEmpty>{marked.length ? "No matching bookmarks." : "No bookmarks yet. Press ⌘B on a line."}</CommandEmpty>
        {marked.length > 0 && (
          <CommandGroup heading={`${marked.length} bookmark${marked.length === 1 ? "" : "s"}`}>
            {marked.map(({ cue, index }) => {
              const text = hideText ? "••••" : cue.text.replace(/\n/g, " ") || "—";
              return (
                <CommandItem
                  key={cue.id}
                  value={`${index + 1} ${cue.bookmark ?? ""} ${hideText ? "" : cue.text}`}
                  onSelect={() => {
                    select(cue.id);
                    clock.seek(cue.start);
                    setOpen(false);
                  }}
                >
                  <Bookmark aria-hidden className="size-3.5 text-primary" />
                  <span className="w-8 text-muted-foreground tabular-nums">{index + 1}</span>
                  <span className="w-24 text-xs text-muted-foreground tabular-nums">
                    {formatTime(cue.start, selectTimeFormat(useSubtitles.getState()))}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    {cue.bookmark && <span className="truncate font-medium">{cue.bookmark}</span>}
                    <span className="truncate text-muted-foreground">{text}</span>
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
