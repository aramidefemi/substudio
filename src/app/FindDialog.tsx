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
import { select, selectTimeFormat, useSubtitles } from "@/features/subtitles/store";
import { formatTime } from "@/features/subtitles/timecode";
import { useUi } from "./actions";

/** ⌘F / ⌘K: jump to any subtitle by its text or number. */
export function FindDialog() {
  const open = useUi((s) => s.findOpen);
  const cues = useSubtitles((s) => s.cues);
  const hideText = useSettings((s) => s.privacy) === "text";
  const setOpen = (findOpen: boolean) => useUi.setState({ findOpen });

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Find subtitle" description="Search subtitle text">
      <CommandInput placeholder={hideText ? "Search by number…" : "Search subtitles…"} />
      <CommandList>
        <CommandEmpty>No matching subtitles.</CommandEmpty>
        {open && (
          <CommandGroup heading={`${cues.length} subtitles`}>
            {cues.map((cue, i) => {
              const label = hideText ? (cue.text ? "••••" : "—") : cue.text || "—";
              return (
                <CommandItem
                  key={cue.id}
                  value={`${i + 1} ${hideText ? "" : cue.text}`}
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
                  <span className="truncate">{label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
