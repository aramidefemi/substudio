import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { removeBookmark, setBookmarkNote, useSubtitles } from "@/features/subtitles/store";
import { useUi } from "./actions";

function NoteForm({ cueId }: { cueId: string }) {
  const cues = useSubtitles((s) => s.cues);
  const index = cues.findIndex((c) => c.id === cueId);
  const cue = cues[index];
  const [note, setNote] = useState(cue?.bookmark ?? "");
  const close = () => useUi.setState({ bookmarkNoteFor: null });
  const save = () => {
    setBookmarkNote(cueId, note.trim());
    close();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Bookmark note</DialogTitle>
        <DialogDescription>
          Line {index + 1}. Saving bookmarks the line{cue?.bookmark === undefined ? "" : " (already bookmarked)"}.
        </DialogDescription>
      </DialogHeader>
      <Input
        autoFocus
        aria-label="Note"
        placeholder="e.g. Check the Yoruba with the director"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
        }}
      />
      <DialogFooter>
        {cue?.bookmark !== undefined && (
          <Button
            variant="outline"
            className="mr-auto"
            onClick={() => {
              removeBookmark(cueId);
              close();
            }}
          >
            Remove bookmark
          </Button>
        )}
        <Button variant="outline" onClick={close}>
          Cancel
        </Button>
        <Button onClick={save}>Save</Button>
      </DialogFooter>
    </>
  );
}

/** ⇧⌘B: add or edit the note on the selected line's bookmark. */
export function BookmarkNoteDialog() {
  const cueId = useUi((s) => s.bookmarkNoteFor);
  return (
    <Dialog open={cueId !== null} onOpenChange={(open) => !open && useUi.setState({ bookmarkNoteFor: null })}>
      <DialogContent className="sm:max-w-md">{cueId && <NoteForm key={cueId} cueId={cueId} />}</DialogContent>
    </Dialog>
  );
}
