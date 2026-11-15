import { create } from "zustand";

/** Open state of the sync dialogs (SYN). */
interface SyncUi {
  visualOpen: boolean;
}

export const useSyncUi = create<SyncUi>()(() => ({
  visualOpen: false,
}));

export const openVisualSync = () => useSyncUi.setState({ visualOpen: true });
export const closeVisualSync = () => useSyncUi.setState({ visualOpen: false });
