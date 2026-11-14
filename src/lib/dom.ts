/** id of the subtitle text box, so shortcuts and double-clicks can focus it. */
export const CUE_TEXT_ID = "cue-text";

export const focusCueText = () => document.getElementById(CUE_TEXT_ID)?.focus();

export const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLSelectElement ||
  (el instanceof HTMLElement && el.isContentEditable);
