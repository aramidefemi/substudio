import { beforeEach, describe, expect, it } from "vitest";
import { nextBookmarkIndex } from "./bookmarks";
import {
  listHistorySteps,
  loadDocument,
  removeBookmark,
  restoreBookmarks,
  select,
  setBookmarkNote,
  splitSelectedAtCursor,
  toggleBookmark,
  undo,
  useSubtitles,
} from "./store";

const cues = () => useSubtitles.getState().cues;

beforeEach(() => {
  loadDocument(
    [
      { start: 0, end: 1, text: "A" },
      { start: 2, end: 3, text: "B" },
      { start: 4, end: 5, text: "C" },
    ],
    null,
  );
});

describe("bookmarks", () => {
  it("toggles on the selected cue as undoable steps", () => {
    select(cues()[1]!.id);
    expect(toggleBookmark()).toBe(true);
    expect(cues()[1]!.bookmark).toBe("");
    expect(useSubtitles.getState().dirty).toBe(true);
    expect(listHistorySteps().at(-1)?.label).toBe("Bookmark");
    expect(toggleBookmark()).toBe(false);
    expect(cues()[1]!.bookmark).toBeUndefined();
    undo();
    expect(cues()[1]!.bookmark).toBe("");
    undo();
    expect(cues()[1]!.bookmark).toBeUndefined();
  });

  it("keeps notes and removes them with the bookmark", () => {
    const id = cues()[0]!.id;
    setBookmarkNote(id, "Check the Yoruba here");
    expect(cues()[0]!.bookmark).toBe("Check the Yoruba here");
    removeBookmark(id);
    expect("bookmark" in cues()[0]!).toBe(false);
  });

  it("stays on the left half when a cue is split", () => {
    const id = cues()[0]!.id;
    select(id);
    setBookmarkNote(id, "n");
    useSubtitles.setState({ cues: cues().map((c) => (c.id === id ? { ...c, text: "One two" } : c)) });
    splitSelectedAtCursor(3);
    expect(cues()[0]!.bookmark).toBe("n");
    expect(cues()[1]!.bookmark).toBeUndefined();
  });

  it("restores by index without adding history", () => {
    restoreBookmarks(new Map([[2, "later"]]));
    expect(cues()[2]!.bookmark).toBe("later");
    expect(useSubtitles.getState().past).toHaveLength(0);
  });

  it("finds the next and previous bookmark, wrapping", () => {
    const list = [{}, { bookmark: "" }, {}, { bookmark: "x" }];
    expect(nextBookmarkIndex(list, 1, 1)).toBe(3);
    expect(nextBookmarkIndex(list, 3, 1)).toBe(1);
    expect(nextBookmarkIndex(list, 1, -1)).toBe(3);
    expect(nextBookmarkIndex(list, 0, 1)).toBe(1);
    expect(nextBookmarkIndex([{ bookmark: "" }], 0, 1)).toBe(0);
    expect(nextBookmarkIndex([{}, {}], 0, 1)).toBe(-1);
    expect(nextBookmarkIndex([], 0, 1)).toBe(-1);
  });
});
