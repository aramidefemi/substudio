import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { useUi } from "../actions";
import { formatShortcut } from "./keys";
import { allCommands, type Command } from "./registry";

/** ⌘⇧K: run any command by name. */
export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = (paletteOpen: boolean) => useUi.setState({ paletteOpen });

  const groups = new Map<string, Command[]>();
  if (open) {
    for (const c of allCommands()) {
      if (c.hidden || c.id === "app.commandPalette") continue;
      groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Run any command">
      <CommandInput placeholder="Type a command…" />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>
        {[...groups].map(([group, commands]) => (
          <CommandGroup key={group} heading={group}>
            {commands.map((c) => (
              <CommandItem
                key={c.id}
                value={`${c.label} ${c.group} ${c.id}`}
                onSelect={() => {
                  setOpen(false);
                  // Let the dialog close and focus return before the command runs.
                  requestAnimationFrame(() => void c.run());
                }}
              >
                <span className="truncate">{c.label}</span>
                {c.keys?.[0] && <CommandShortcut>{formatShortcut(c.keys[0])}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
