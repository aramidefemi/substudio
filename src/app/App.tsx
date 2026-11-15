import { useDefaultLayout } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TransportBar } from "@/features/playback/TransportBar";
import { VideoPanel } from "@/features/playback/VideoPanel";
import { CueEditor } from "@/features/subtitles/CueEditor";
import { SubtitleList } from "@/features/subtitles/SubtitleList";
import { Waveform } from "@/features/waveform/Waveform";
import { BookmarkNoteDialog } from "./BookmarkNoteDialog";
import { GoToLineDialog } from "./GoToLineDialog";
import { BookmarksDialog } from "./BookmarksDialog";
import { CompareDialog } from "./CompareDialog";
import { DropOverlay } from "./DropOverlay";
import { EncodingDialog } from "./EncodingDialog";
import { ErrorsPanel } from "./ErrorsPanel";
import { CommandPalette } from "./commands/CommandPalette";
import { FindDialog } from "./FindDialog";
import { HistoryDialog } from "./HistoryDialog";
import { MediaInfoDialog } from "./MediaInfoDialog";
import { RecentDialog } from "./RecentDialog";
import { ReplaceDialog } from "./ReplaceDialog";
import { RestoreBackupDialog } from "./RestoreBackupDialog";
import { StatisticsDialog } from "./StatisticsDialog";
import { Toolbar } from "./Toolbar";
import { useAppEvents } from "./useAppEvents";
import { useFileSafety } from "./useFileSafety";

/** Gaps between panels are the resize handles. */
const Gap = ({ vertical }: { vertical?: boolean }) => (
  <ResizableHandle
    className={
      // Beat ResizableHandle's aria-[orientation=horizontal]:h-px (more specific than h-*).
      vertical
        ? "h-3 bg-transparent aria-[orientation=horizontal]:h-3"
        : "w-3 bg-transparent"
    }
  />
);

export default function App() {
  useAppEvents();
  useFileSafety();
  const main = useDefaultLayout({ id: "layout.main" });
  const top = useDefaultLayout({ id: "layout.top" });
  const left = useDefaultLayout({ id: "layout.left" });

  return (
    <TooltipProvider delayDuration={500}>
      <div className="flex h-full flex-col">
        <Toolbar />
        <main className="min-h-0 flex-1 p-2">
          <ResizablePanelGroup orientation="vertical" {...main}>
            <ResizablePanel id="top" defaultSize="68" minSize="35">
              <ResizablePanelGroup orientation="horizontal" {...top}>
                <ResizablePanel id="left" defaultSize="52" minSize="30">
                  <ResizablePanelGroup orientation="vertical" {...left}>
                    <ResizablePanel id="list" defaultSize="60" minSize="20">
                      <SubtitleList />
                    </ResizablePanel>
                    <Gap vertical />
                    <ResizablePanel id="editor" defaultSize="40" minSize={150}>
                      <CueEditor />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </ResizablePanel>
                <Gap />
                <ResizablePanel id="video" defaultSize="48" minSize="25">
                  <VideoPanel />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
            <Gap vertical />
            <ResizablePanel id="waveform" defaultSize="32" minSize={110}>
              <Waveform />
            </ResizablePanel>
          </ResizablePanelGroup>
        </main>
        <TransportBar />
      </div>
      <FindDialog />
      <ReplaceDialog />
      <ErrorsPanel />
      <BookmarksDialog />
      <BookmarkNoteDialog />
      <GoToLineDialog />
      <CommandPalette />
      <RecentDialog />
      <EncodingDialog />
      <RestoreBackupDialog />
      <StatisticsDialog />
      <CompareDialog />
      <MediaInfoDialog />
      <HistoryDialog />
      <DropOverlay />
      <Toaster position="bottom-center" />
    </TooltipProvider>
  );
}
