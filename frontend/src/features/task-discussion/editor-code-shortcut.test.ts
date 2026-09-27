import { CodeNode } from "@lexical/code-core";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  createEditor,
  HISTORIC_TAG,
  type LexicalEditor,
  PASTE_TAG,
} from "lexical";
import { describe, expect, it } from "vitest";
import { registerImmediateCodeFence } from "./editor-code-shortcut";

function createTestEditor() {
  const editor = createEditor({
    nodes: [CodeNode],
    onError: (error) => {
      throw error;
    },
  });
  registerImmediateCodeFence(editor);
  editor.update(() => $getRoot().append($createParagraphNode()).selectEnd(), { discrete: true });
  return editor;
}

async function type(editor: LexicalEditor, text: string, tag?: string) {
  editor.update(
    () => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error("Expected text selection");
      selection.insertText(text);
    },
    { discrete: true, ...(tag ? { tag } : {}) },
  );
  await Promise.resolve();
}

function blocks(editor: LexicalEditor) {
  return editor.getEditorState().read(() =>
    $getRoot()
      .getChildren()
      .map((node) => ({ type: node.getType(), text: node.getTextContent() })),
  );
}

describe("immediate code fence", () => {
  it("converts only the third typed backtick and keeps the caret in the code block", async () => {
    const editor = createTestEditor();
    await type(editor, "`");
    await type(editor, "`");
    expect(blocks(editor)).toEqual([{ type: "paragraph", text: "``" }]);
    await type(editor, "`");
    expect(blocks(editor)).toEqual([{ type: "code", text: "" }]);
    await type(editor, "literal");
    expect(blocks(editor)).toEqual([{ type: "code", text: "literal" }]);
  });

  it("preserves preceding soft lines and formatting", async () => {
    const editor = createTestEditor();
    editor.update(
      () => {
        const paragraph = $createParagraphNode().append(
          $createTextNode("Keep").toggleFormat("bold"),
          $createLineBreakNode(),
          $createTextNode("``"),
        );
        $getRoot().clear().append(paragraph);
        paragraph.selectEnd();
      },
      { discrete: true },
    );
    await type(editor, "`");
    expect(blocks(editor)).toEqual([
      { type: "paragraph", text: "Keep" },
      { type: "code", text: "" },
    ]);
    expect(
      editor.getEditorState().read(() => $getRoot().getFirstDescendant()?.exportJSON()),
    ).toMatchObject({ format: 1 });
  });

  it.each([PASTE_TAG, HISTORIC_TAG])("leaves %s updates literal", async (tag) => {
    const editor = createTestEditor();
    await type(editor, "``");
    await type(editor, "`", tag);
    expect(blocks(editor)).toEqual([{ type: "paragraph", text: "```" }]);
  });

  it("does not turn a pasted or imported complete fence into code", async () => {
    const editor = createTestEditor();
    await type(editor, "```");
    expect(blocks(editor)).toEqual([{ type: "paragraph", text: "```" }]);
  });

  it.each(["prefix ``", "``suffix"])("does not consume surrounding content: %s", async (text) => {
    const editor = createTestEditor();
    await type(editor, text);
    if (text === "``suffix")
      editor.update(
        () => {
          const node = $getRoot().getFirstDescendant();
          if (!$isTextNode(node)) throw new Error("Expected text node");
          node.select(2, 2);
        },
        { discrete: true },
      );
    await type(editor, "`");
    expect(blocks(editor)[0]?.type).toBe("paragraph");
    expect(blocks(editor)[0]?.text).toBe(text === "``suffix" ? "```suffix" : "prefix ```");
  });

  it("leaves inline-code literals alone", async () => {
    const editor = createTestEditor();
    await type(editor, "``");
    editor.update(
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) selection.formatText("code");
      },
      { discrete: true },
    );
    await type(editor, "`");
    expect(blocks(editor)).toEqual([{ type: "paragraph", text: "```" }]);
  });

  it("does not convert a replacement selection", async () => {
    const editor = createTestEditor();
    await type(editor, "``x");
    editor.update(
      () => {
        const node = $getRoot().getFirstDescendant();
        if (!$isTextNode(node)) throw new Error("Expected text node");
        node.select(2, 3);
      },
      { discrete: true },
    );
    await type(editor, "`");
    expect(blocks(editor)).toEqual([{ type: "paragraph", text: "```" }]);
  });
});
