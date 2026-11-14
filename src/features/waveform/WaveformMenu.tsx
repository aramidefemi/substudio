import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { formatShortcut } from "@/app/commands/keys";
import { getCommand, runCommand } from "@/app/commands/registry";
import type { MenuTarget } from "./context";

function Item({
  id,
  label,
  disabled,
  destructive,
}: {
  id: string;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const key = getCommand(id)?.keys?.[0];
  return (
    <ContextMenuItem
      disabled={disabled}
      variant={destructive ? "destructive" : "default"}
      onSelect={() => runCommand(id)}
    >
      {label}
      {key && <ContextMenuShortcut>{formatShortcut(key)}</ContextMenuShortcut>}
    </ContextMenuItem>
  );
}

/** Right-click menu for the waveform. Every item runs a registry command. */
export function WaveformMenu({ target, hasRegion }: { target: MenuTarget | null; hasRegion: boolean }) {
  const onCue = !!target?.cueId;
  return (
    // Keep focus where the command put it (e.g. the text box after inserting).
    <ContextMenuContent className="min-w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
      {hasRegion && (
        <>
          <Item id="waveform.createFromRegion" label="Create subtitle from marked region" />
          <ContextMenuSeparator />
        </>
      )}
      <Item id="waveform.insertHere" label="Insert subtitle here" disabled={!target?.canInsert} />
      <Item id="waveform.splitHere" label="Split at this position" disabled={!target?.canSplit} />
      <ContextMenuSeparator />
      <Item id="edit.mergePrevious" label="Merge with previous" disabled={!target?.canMergePrevious} />
      <Item id="edit.mergeNext" label="Merge with next" disabled={!target?.canMergeNext} />
      <ContextMenuSeparator />
      <Item id="edit.deleteLines" label="Delete" disabled={!onCue} destructive />
    </ContextMenuContent>
  );
}
