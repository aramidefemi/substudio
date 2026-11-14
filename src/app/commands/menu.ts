import { invoke } from "@tauri-apps/api/core";
import { inTauri } from "@/lib/tauri";
import { toAccelerator } from "./keys";
import { getCommand } from "./registry";

/**
 * Native menu bar layout. Entries are command ids; `[id, label]` overrides the
 * label where the submenu already gives context ("Move Start" › "−1 Frame").
 * The macOS app menu and the Window menu are added in `src-tauri/src/menu.rs`.
 */
type Entry = string | [id: string, label: string] | "-" | MenuGroup;
interface MenuGroup {
  submenu: string;
  items: Entry[];
}

const moveEdge = (base: string): Entry[] => [
  [`${base}.frame.-`, "−1 Frame"],
  [`${base}.frame.+`, "+1 Frame"],
  [`${base}.ms.-`, "−100 ms"],
  [`${base}.ms.+`, "+100 ms"],
  [`${base}.custom.-`, "−Custom ms"],
  [`${base}.custom.+`, "+Custom ms"],
  "-",
  [`${base}.keepGap.frame.-`, "−1 Frame (Keep Gap)"],
  [`${base}.keepGap.frame.+`, "+1 Frame (Keep Gap)"],
  [`${base}.push.frame.-`, "−1 Frame (Push)"],
  [`${base}.push.frame.+`, "+1 Frame (Push)"],
];

const steps = (base: string, withCustom = true): Entry[] => [
  [`${base}.frame.-`, "−1 Frame"],
  [`${base}.frame.+`, "+1 Frame"],
  [`${base}.ms.-`, "−100 ms"],
  [`${base}.ms.+`, "+100 ms"],
  ...(withCustom
    ? ([
        [`${base}.custom.-`, "−Custom ms"],
        [`${base}.custom.+`, "+Custom ms"],
      ] as Entry[])
    : []),
];

export const MENU: MenuGroup[] = [
  {
    submenu: "File",
    items: [
      "file.new",
      "file.newKeepingVideo",
      "-",
      "file.open",
      "file.openKeepingVideo",
      "file.importEncoding",
      { submenu: "Open Recent", items: ["file.recent", "file.recent.clear"] },
      "file.openVideo",
      "-",
      "file.save",
      "file.saveAs",
      "file.saveAsVtt",
      "file.saveSelected",
      "-",
      "file.openContainingFolder",
      "file.openDataFolder",
      "file.copyPath",
      "file.reload",
      "-",
      "file.restoreBackup",
      "-",
      "file.compare",
      "file.statistics",
      "file.mediaInfo",
    ],
  },
  {
    submenu: "Edit",
    items: [
      "edit.undo",
      "edit.redo",
      "edit.history",
      "-",
      "edit.cut",
      "edit.copy",
      "edit.paste",
      "edit.selectAll",
      "edit.invertSelection",
      "-",
      {
        submenu: "Lines",
        items: [
          ["edit.insertBefore", "Insert Before"],
          ["edit.insertAfter", "Insert After"],
          ["edit.insertAtEnd", "Insert at End"],
          ["edit.insertAtPlayhead", "Insert at Playhead"],
          "-",
          ["edit.deleteLines", "Delete"],
          "edit.rippleDelete",
          ["edit.duplicate", "Duplicate"],
          "edit.removeBlankLines",
          "-",
          "edit.splitAtCursor",
          "edit.splitAtVideo",
          "-",
          {
            submenu: "Merge with Previous",
            items: [
              ["edit.mergePrevious", "Keep Breaks"],
              ["edit.mergePrevious.unbreak", "Unbreak"],
              ["edit.mergePrevious.dialog", "As Dialog"],
            ],
          },
          {
            submenu: "Merge with Next",
            items: [
              ["edit.mergeNext", "Keep Breaks"],
              ["edit.mergeNext.unbreak", "Unbreak"],
              ["edit.mergeNext.dialog", "As Dialog"],
            ],
          },
          {
            submenu: "Merge Selected",
            items: [
              ["edit.mergeSelected", "Keep Breaks"],
              ["edit.mergeSelected.unbreak", "Unbreak"],
              ["edit.mergeSelected.dialog", "As Dialog"],
            ],
          },
        ],
      },
      "-",
      "edit.italic",
      "edit.toggleLineBreak",
      "edit.unbreak",
      "edit.autoBreak",
      "edit.balanceLines",
      "edit.breakAtFirstSpace",
      "edit.toggleDialogDashes",
      "edit.trimWhitespace",
      "-",
      "edit.find",
      "edit.replace",
      "edit.findNext",
      "edit.findPrevious",
      "-",
      {
        submenu: "Bookmarks",
        items: [
          ["nav.toggleBookmark", "Toggle Bookmark"],
          ["nav.bookmarkNote", "Edit Note…"],
          "-",
          ["nav.nextBookmark", "Next Bookmark"],
          ["nav.previousBookmark", "Previous Bookmark"],
          "-",
          ["nav.bookmarks", "List Bookmarks…"],
        ],
      },
      "-",
      "app.commandPalette",
    ],
  },
  {
    submenu: "View",
    items: [
      {
        submenu: "Theme",
        items: [
          ["view.theme.system", "Match System"],
          ["view.theme.light", "Light"],
          ["view.theme.dark", "Dark"],
        ],
      },
      {
        submenu: "Row Density",
        items: [
          ["view.density.compact", "Compact"],
          ["view.density.comfortable", "Comfortable"],
        ],
      },
      {
        submenu: "Columns",
        items: [
          ["view.column.cps", "CPS"],
          ["view.column.gap", "Gap"],
        ],
      },
      {
        submenu: "Subtitle Preview",
        items: [
          ["view.preview.box", "Background Box"],
          ["view.preview.outline", "Outline"],
          "-",
          ["view.preview.bigger", "Bigger Text"],
          ["view.preview.smaller", "Smaller Text"],
          "-",
          ["view.preview.higher", "Move Up"],
          ["view.preview.lower", "Move Down"],
        ],
      },
      "view.errors",
      "-",
      "view.timecode",
      "view.formatting",
      "view.privacy",
    ],
  },
  {
    submenu: "Playback",
    items: [
      "playback.toggle",
      "-",
      "playback.playSelection",
      "playback.loopSelection",
      "playback.playBefore",
      "-",
      "playback.playPrevious",
      "playback.playNext",
      "playback.loopPrevious",
      "playback.loopNext",
      "nav.nextAndPlay",
      "-",
      {
        submenu: "Step",
        items: [
          ["playback.step.frame.-", "Back 1 Frame"],
          ["playback.step.frame.+", "Forward 1 Frame"],
          "-",
          ["playback.step.100ms.-", "Back 100 ms"],
          ["playback.step.100ms.+", "Forward 100 ms"],
          ["playback.step.500ms.-", "Back 500 ms"],
          ["playback.step.500ms.+", "Forward 500 ms"],
          ["playback.step.1s.-", "Back 1 s"],
          ["playback.step.1s.+", "Forward 1 s"],
        ],
      },
      "-",
      {
        submenu: "Speed",
        items: [
          ["playback.speed.faster", "Faster"],
          ["playback.speed.slower", "Slower"],
          ["playback.speed.normal", "Normal"],
        ],
      },
    ],
  },
  {
    submenu: "Timing",
    items: [
      { submenu: "Move Start", items: moveEdge("timing.moveStart") },
      { submenu: "Move End", items: moveEdge("timing.moveEnd") },
      {
        submenu: "Move Selected",
        items: [
          ...steps("timing.moveSelected"),
          "-",
          ["timing.moveSelectedFollowing.frame.-", "−1 Frame + Following"],
          ["timing.moveSelectedFollowing.frame.+", "+1 Frame + Following"],
          ["timing.moveSelectedFollowing.ms.-", "−100 ms + Following"],
          ["timing.moveSelectedFollowing.ms.+", "+100 ms + Following"],
        ],
      },
      { submenu: "Move All", items: steps("timing.moveAll") },
      "-",
      "timing.holdToTime",
      "timing.setStart",
      "timing.setEnd",
      "timing.setStartGoNext",
      "timing.setEndGoNext",
      "timing.setStartKeepDuration",
      "timing.setStartOffsetRest",
      "timing.setEndAddNew",
      "timing.setEndAndNextAfterGap",
      "timing.setStartAndPrevMinusGap",
      "-",
      "timing.extendToPrevious",
      "timing.extendToNext",
      "timing.extendPreviousEnd",
      "timing.extendNextStart",
      "-",
      "timing.snapAllToFrames",
    ],
  },
  {
    submenu: "Waveform",
    items: [
      "waveform.createFromRegion",
      "waveform.clearRegion",
      "-",
      "waveform.seekSilenceBack",
      "waveform.seekSilenceForward",
      "-",
      "waveform.guessStart",
      "waveform.guessEnd",
      "waveform.guessTimes",
    ],
  },
];

/** Mirrors `MenuSpec` in `src-tauri/src/menu.rs`. */
export type MenuSpec =
  | { type: "item"; id: string; label: string; accelerator: string | null }
  | { type: "separator" }
  | { type: "submenu"; label: string; items: MenuSpec[] };

/** Ids that appear in the menu bar (their global keys are owned by native accelerators). */
export function menuCommandIds(groups: MenuGroup[] = MENU): Set<string> {
  const ids = new Set<string>();
  const walk = (entries: Entry[]) => {
    for (const e of entries) {
      if (e === "-") continue;
      if (typeof e === "string") ids.add(e);
      else if (Array.isArray(e)) ids.add(e[0]);
      else walk(e.items);
    }
  };
  groups.forEach((g) => walk(g.items));
  return ids;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function toSpec(entry: Entry): MenuSpec {
  if (entry === "-") return { type: "separator" };
  if (!Array.isArray(entry) && typeof entry === "object") {
    return { type: "submenu", label: entry.submenu, items: entry.items.map(toSpec) };
  }
  const [id, override] = Array.isArray(entry) ? entry : [entry, undefined];
  const command = getCommand(id);
  if (!command) throw new Error(`Menu references unknown command: ${id}`);
  // Only global shortcuts become native accelerators: they fire even while typing.
  const key = command.scope === "outsideText" ? undefined : command.keys?.[0];
  return {
    type: "item",
    id,
    label: override ?? capitalise(command.label),
    accelerator: key ? toAccelerator(key) : null,
  };
}

export function buildMenuSpec(groups: MenuGroup[] = MENU): MenuSpec[] {
  return groups.map(toSpec);
}

export async function installNativeMenu() {
  if (!inTauri) return;
  await invoke("set_menu", { spec: buildMenuSpec() });
}
