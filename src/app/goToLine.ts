import { create } from "zustand";

/** Open state of the Go to line dialog (EDT-05). */
export const useGoToLine = create<{ open: boolean }>()(() => ({ open: false }));

export const openGoToLine = () => useGoToLine.setState({ open: true });
export const closeGoToLine = () => useGoToLine.setState({ open: false });
