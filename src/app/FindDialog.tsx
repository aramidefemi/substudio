import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { clock } from "@/features/playback/clock";
import { select, selectTimeFormat, useSubtitles } from "@/features/subtitles/store";
import { formatTime } from "@/features/subtitles/timecode";
import { useUi } from "./actions";

/** ⌘F / ⌘K: jump to any subtitle by its text or number. */
export function FindDialog() {
  const open = useUi((s) => s.findOpen);
  const cues = useSubtitles((s) => s.cues);
  const setOpen = (findOpen: boolean) => useUi.setState({ findOpen });

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Find subtitle" description="Search subtitle text">
      <CommandInput placeholder="Search subtitles…" />
      <CommandList>
        <CommandEmpty>No matching subtitles.</CommandEmpty>
        {open && (
          <CommandGroup heading={`${cues.length} subtitles`}>
            {cues.map((cue, i) => (
              <CommandItem
                key={cue.id}
                value={`${i + 1} ${cue.text}`}
                onSelect={() => {
                  select(cue.id);
                  clock.seek(cue.start);
                  setOpen(false);
                }}
              >
                <span className="w-8 text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="w-24 text-xs text-muted-foreground tabular-nums">
                  {formatTime(cue.start, selectTimeFormat(useSubtitles.getState()))}
                </span>
                <span className="truncate">{cue.text || "—"}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
