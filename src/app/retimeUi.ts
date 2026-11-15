import { create } from "zustand";
import type { ShiftScope } from "@/features/subtitles/retime";

/** Open state of the sync retiming dialogs (SYN-01 / SYN-03), plus last inputs. */
interface RetimeUi {
  adjustOpen: boolean;
  frameRateOpen: boolean;
  speedOpen: boolean;
  /** Last offset typed in Adjust times (without the sign), and its sign. */
  lastOffset: string;
  lastNegative: boolean;
  lastScope: ShiftScope | null;
  lastFromFps: string;
  lastToFps: string;
  lastSpeedFactor: string;
}

export const useRetimeUi = create<RetimeUi>()(() => ({
  adjustOpen: false,
  frameRateOpen: false,
  speedOpen: false,
  lastOffset: "",
  lastNegative: false,
  lastScope: null,
  lastFromFps: "",
  lastToFps: "",
  lastSpeedFactor: "1",
}));

export const openAdjustTimes = () => useRetimeUi.setState({ adjustOpen: true });
export const closeAdjustTimes = () => useRetimeUi.setState({ adjustOpen: false });

export const openChangeFrameRate = () => useRetimeUi.setState({ frameRateOpen: true });
export const closeChangeFrameRate = () => useRetimeUi.setState({ frameRateOpen: false });

export const openChangeSpeed = () => useRetimeUi.setState({ speedOpen: true });
export const closeChangeSpeed = () => useRetimeUi.setState({ speedOpen: false });
