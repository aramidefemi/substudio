import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { commands, inTauri } from "@/lib/tauri";
import { importWithEncoding, useUi } from "./actions";

const FALLBACK = ["utf-8", "windows-1252", "iso-8859-1", "windows-1250", "macintosh"];

/** File → Import with Encoding: pick a legacy encoding then open. */
export function EncodingDialog() {
  const open = useUi((s) => s.encodingOpen);
  const setOpen = (encodingOpen: boolean) => useUi.setState({ encodingOpen });
  const [encodings, setEncodings] = useState(FALLBACK);
  const [encoding, setEncoding] = useState("windows-1252");

  useEffect(() => {
    if (!open || !inTauri) return;
    void commands.listEncodings().then(setEncodings).catch(() => undefined);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import with encoding</DialogTitle>
          <DialogDescription>Choose the character encoding for a legacy subtitle file.</DialogDescription>
        </DialogHeader>
        <Select value={encoding} onValueChange={setEncoding}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Encoding" />
          </SelectTrigger>
          <SelectContent>
            {encodings.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              void importWithEncoding(encoding);
            }}
          >
            Choose file…
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
