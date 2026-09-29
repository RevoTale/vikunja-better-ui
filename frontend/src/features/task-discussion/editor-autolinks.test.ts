import { $createCodeNode, CodeNode } from "@lexical/code-core";
import { $isLinkNode, LinkNode } from "@lexical/link";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  createEditor,
  HISTORIC_TAG,
  INSERT_PARAGRAPH_COMMAND,
  PASTE_TAG,
} from "lexical";
import { describe, expect, it, vi } from "vitest";
import { registerDiscussionLinks, taskLinkId } from "./editor-autolinks";

const origin = "http://localhost:4180";
const href = `${origin}/tasks/137`;
function setup(resolve = async (_id: string): Promise<string | null> => null) {
  const editor = createEditor({
    nodes: [LinkNode, CodeNode],
    onError: (error) => {
      throw error;
    },
  });
  const dispose = registerDiscussionLinks(editor, origin, resolve);
  editor.update(() => $getRoot().append($createParagraphNode()).selectEnd(), { discrete: true });
  const insert = async (text: string, tag?: string) => {
    editor.update(
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) selection.insertText(text);
      },
      { discrete: true, ...(tag ? { tag } : {}) },
    );
    await Promise.resolve();
  };
  const links = () =>
    editor.read(() =>
      $getRoot()
        .getAllTextNodes()
        .filter((node) => $isLinkNode(node.getParent()))
        .map((node) => node.getTextContent()),
    );
  return { editor, insert, links, dispose };
}

describe("editor links", () => {
  it("does not link unfinished typing before an existing space", async () => {
    const { editor, insert, links } = setup();
    await insert(" ");
    editor.update(() => $getRoot().getAllTextNodes()[0]?.select(0, 0), { discrete: true });
    for (const character of "https://example.com") await insert(character);
    expect(links()).toEqual([]);
    await insert(" ");
    expect(links()).toEqual(["https://example.com"]);
  });
  it("links on Enter before existing trailing whitespace", async () => {
    const { editor, insert, links } = setup();
    await insert(" ");
    editor.update(() => $getRoot().getAllTextNodes()[0]?.select(0, 0), { discrete: true });
    await insert("https://example.com");
    expect(links()).toEqual([]);
    editor.update(() => editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined), {
      discrete: true,
    });
    expect(links()).toEqual(["https://example.com"]);
  });
  it("preserves pasted code-block URLs literally", async () => {
    const resolve = vi.fn(async () => "Task title");
    const { editor, insert, links } = setup(resolve);
    editor.update(() => $getRoot().clear().append($createCodeNode()).selectEnd(), {
      discrete: true,
    });
    await insert(href, PASTE_TAG);
    expect(links()).toEqual([]);
    expect(resolve).not.toHaveBeenCalled();
  });
  it("links on whitespace or paste, not incomplete typing", async () => {
    const { insert, links } = setup();
    await insert("https://example.com");
    expect(links()).toEqual([]);
    await insert(" ");
    expect(links()).toEqual(["https://example.com"]);
    await insert("http://localhost:4180/test", PASTE_TAG);
    expect(links()).toEqual(["https://example.com", "http://localhost:4180/test"]);
  });
  it("leaves inline code literal", async () => {
    const { editor, insert, links } = setup();
    editor.update(
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) selection.formatText("code");
      },
      { discrete: true },
    );
    await insert(href, PASTE_TAG);
    expect(links()).toEqual([]);
  });
});

describe("task link title resolution", () => {
  it("saves an optional title snapshot", async () => {
    const { insert, links } = setup(async () => "Referenced task");
    await insert(href, PASTE_TAG);
    await vi.waitFor(() => expect(links()).toEqual(["Referenced task"]));
  });
  it.each(["edit", "remove", "disable", "dispose", "undo"])(
    "ignores delayed lookup after %s",
    async (action) => {
      let finish: (title: string) => void = () => {};
      const { editor, insert, links, dispose } = setup(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      await insert(href, PASTE_TAG);
      if (action === "disable") editor.setEditable(false);
      else if (action === "dispose") dispose();
      else
        editor.update(
          () => {
            const text = $getRoot().getAllTextNodes()[0];
            if (action === "remove") $getRoot().clear().append($createParagraphNode());
            else text?.setTextContent("My own label");
          },
          { discrete: true, ...(action === "undo" ? { tag: HISTORIC_TAG } : {}) },
        );
      finish("Do not overwrite");
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(links()).not.toContain("Do not overwrite");
    },
  );
  it("retains URL on lookup failure", async () => {
    const { insert, links } = setup(async () => {
      throw new Error("Unavailable");
    });
    await insert(href, PASTE_TAG);
    await Promise.resolve();
    expect(links()).toEqual([href]);
  });
  it("does not replace custom labels", () => {
    const resolve = vi.fn(async () => "Other title");
    const { editor } = setup(resolve);
    editor.update(
      () =>
        $getRoot()
          .getFirstChildOrThrow()
          .insertAfter(
            $createParagraphNode().append(new LinkNode(href).append($createTextNode("My label"))),
          ),
      { discrete: true },
    );
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe("taskLinkId", () => {
  it.each([href, `${href}/discussion?returnTo=/week#comment-3`, `${href}/edit`])(
    "recognizes own task routes: %s",
    (value) => expect(taskLinkId(value, origin)).toBe("137"),
  );
  it.each([
    "https://other.test/tasks/137",
    `${origin}/tasks/0`,
    `${origin}/tasks/137/delete`,
    `${origin}/tasks/999999999999999999999`,
    `http://user@localhost:4180/tasks/137`,
  ])("rejects unrelated or invalid URLs: %s", (value) =>
    expect(taskLinkId(value, origin)).toBeNull(),
  );
});
