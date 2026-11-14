/** id of the subtitle text box, so shortcuts and double-clicks can focus it. */
export const CUE_TEXT_ID = "cue-text";

export const focusCueText = () => document.getElementById(CUE_TEXT_ID)?.focus();

export function cueTextArea(): HTMLTextAreaElement | null {
  const el = document.getElementById(CUE_TEXT_ID);
  return el instanceof HTMLTextAreaElement ? el : null;
}

/** Selection in the cue text box when it is focused; otherwise null. */
export function cueTextSelection(): { start: number; end: number } | null {
  const el = cueTextArea();
  if (!el || document.activeElement !== el) return null;
  return { start: el.selectionStart, end: el.selectionEnd };
}

export function setCueTextSelection(start: number, end = start) {
  const el = cueTextArea();
  if (!el) return;
  el.focus();
  el.setSelectionRange(start, end);
}

export const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLSelectElement ||
  (el instanceof HTMLElement && el.isContentEditable);
