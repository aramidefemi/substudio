/**
 * Stock Subtitle Edit shortcuts for commands Substudio has.
 * Ctrl → `$mod` (Cmd on Mac). Timing/playback F5–F12 follow the classic SE4
 * family Substudio already ships (F10 = set end & go next; F8 = play next).
 * Replace uses ⌥⌘F (SE’s macOS default) so ⌘H does not hide the app.
 */
export const SE_PRESET: Readonly<Record<string, readonly string[]>> = {
  "file.new": ["$mod+KeyN"],
  "file.open": ["$mod+KeyO"],
  "file.save": ["$mod+KeyS"],
  "file.saveAs": ["$mod+Shift+KeyS"],
  "file.batchConvert": ["$mod+KeyB"],
  "file.openDataFolder": ["$mod+Alt+Shift+KeyD"],

  "edit.undo": ["$mod+KeyZ"],
  "edit.redo": ["$mod+Shift+KeyZ"],
  "edit.find": ["$mod+KeyF"],
  "edit.findNext": ["F3"],
  "edit.findPrevious": ["Shift+F3"],
  "edit.replace": ["$mod+Alt+KeyF"],
  "edit.cut": ["$mod+KeyX"],
  "edit.copy": ["$mod+KeyC"],
  "edit.paste": ["$mod+KeyV"],
  "edit.pastePlainText": ["$mod+Shift+KeyV"],
  "edit.selectAll": ["$mod+KeyA"],
  "edit.invertSelection": ["$mod+Shift+KeyI"],
  "edit.italic": ["$mod+KeyI"],
  "edit.autoBreak": ["$mod+KeyR"],
  "edit.splitAtCursor": ["$mod+Alt+KeyV"],
  "edit.insertAfter": ["Alt+Insert"],
  "edit.insertBefore": ["$mod+Shift+Insert"],
  "edit.deleteLines": ["Delete"],
  "edit.mergeSelected": ["$mod+Shift+KeyM"],

  "nav.goToLine": ["$mod+KeyG"],
  "nav.focusList": ["$mod+KeyL"],
  "nav.bookmarkNote": ["$mod+Shift+KeyB"],
  "nav.previous": ["Alt+ArrowUp", "ArrowUp"],
  "nav.next": ["Alt+ArrowDown", "ArrowDown"],

  "view.errors": ["$mod+F8"],

  "playback.toggle": ["Space"],
  "playback.playSelection": ["F5"],
  "playback.loopSelection": ["Shift+F5"],
  "playback.playBefore": ["F6"],
  "playback.playPrevious": ["F7"],
  "playback.playNext": ["F8"],
  "playback.loopPrevious": ["Shift+F7"],
  "playback.loopNext": ["Shift+F8"],
  "playback.step.1s.-": ["ArrowLeft"],
  "playback.step.1s.+": ["ArrowRight"],
  "playback.step.500ms.-": ["Alt+ArrowLeft"],
  "playback.step.500ms.+": ["Alt+ArrowRight"],

  "timing.setStart": ["F11"],
  "timing.setEnd": ["F12"],
  "timing.setStartOffsetRest": ["F9"],
  "timing.setEndGoNext": ["F10"],
  "timing.setEndAddNew": ["Shift+F10"],
  "timing.extendToNext": ["$mod+Shift+KeyE"],
  "timing.extendToPrevious": ["Alt+Shift+KeyE"],

  "sync.adjustTimes": ["$mod+Shift+KeyA"],

  "tools.multipleReplace": ["$mod+Shift+KeyR"],
  "tools.fixCommon": ["$mod+Shift+KeyF"],
  "tools.textTools": ["$mod+Shift+KeyC"],
  "tools.removeHi": ["$mod+Shift+KeyH"],
  "tools.spellCheck": ["Alt+F7"],

  "app.commandPalette": ["$mod+Shift+KeyK"],
};

/** Keys claimed by the SE preset (for stripping conflicting Substudio defaults). */
export function sePresetKeySet(preset: Readonly<Record<string, readonly string[]>> = SE_PRESET): Set<string> {
  const used = new Set<string>();
  for (const keys of Object.values(preset)) for (const k of keys) used.add(k);
  return used;
}
