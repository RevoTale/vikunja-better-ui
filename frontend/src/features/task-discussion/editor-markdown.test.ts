import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  createEditor,
} from "lexical";
import { describe, expect, it } from "vitest";
import { $normalizeCodeFence } from "./editor-markdown";

function createTestEditor() {
  return createEditor({
    onError: (error) => {
      throw error;
    },
  });
}

describe("discussion code fence normalization", () => {
  it("keeps an inline-code fence literal in its original soft line", () => {
    const editor = createTestEditor();
    editor.update(
      () => {
        const root = $getRoot();
        const text = $createTextNode("```js").toggleFormat("code");
        root.append(
          $createParagraphNode().append($createTextNode("Keep"), $createLineBreakNode(), text),
        );
        text.selectEnd();
        $normalizeCodeFence();
        expect(root.getChildrenSize()).toBe(1);
        expect(root.getTextContent()).toBe("Keep\n```js");
        expect(text.hasFormat("code")).toBe(true);
      },
      { discrete: true },
    );
  });

  it.each(["```", "```js", "```typescript", "````css"])(
    "separates %s while preserving preceding formatting and the caret",
    (fence) => {
      const editor = createTestEditor();
      editor.update(
        () => {
          const root = $getRoot();
          const prefix = $createTextNode("Keep this").toggleFormat("bold");
          const text = $createTextNode(fence);
          root.append($createParagraphNode().append(prefix, $createLineBreakNode(), text));
          text.selectEnd();
          $normalizeCodeFence();
          expect(root.getChildrenSize()).toBe(2);
          expect(root.getFirstChild()?.getTextContent()).toBe("Keep this");
          expect(prefix.hasFormat("bold")).toBe(true);
          expect(root.getLastChild()?.getTextContent()).toBe(fence);
          const selection = $getSelection();
          expect($isRangeSelection(selection) && selection.anchor.key).toBe(text.getKey());
        },
        { discrete: true },
      );
    },
  );

  it.each(["`inline`", "prefix ```", "```js more text", "not a fence"])(
    "leaves ordinary soft lines unchanged: %s",
    (value) => {
      const editor = createTestEditor();
      editor.update(
        () => {
          const root = $getRoot();
          const text = $createTextNode(value);
          root.append($createParagraphNode().append($createLineBreakNode(), text));
          text.selectEnd();
          $normalizeCodeFence();
          expect(root.getChildrenSize()).toBe(1);
          expect(root.getTextContent()).toBe(`\n${value}`);
        },
        { discrete: true },
      );
    },
  );

  it("does not normalize a selected range or discard content after the caret", () => {
    const editor = createTestEditor();
    editor.update(
      () => {
        const root = $getRoot();
        const text = $createTextNode("```js");
        const paragraph = $createParagraphNode().append($createLineBreakNode(), text);
        root.append(paragraph);
        text.select(0, 5);
        $normalizeCodeFence();
        expect(root.getChildrenSize()).toBe(1);
        text.selectEnd();
        paragraph.append($createLineBreakNode(), $createTextNode("Keep after"));
        $normalizeCodeFence();
        expect(root.getChildrenSize()).toBe(1);
        expect(root.getTextContent()).toBe("\n```js\nKeep after");
      },
      { discrete: true },
    );
  });

  it("does not leave an empty paragraph when only a leading soft break exists", () => {
    const editor = createTestEditor();
    editor.update(
      () => {
        const root = $getRoot();
        const text = $createTextNode("```");
        root.append($createParagraphNode().append($createLineBreakNode(), text));
        text.selectEnd();
        $normalizeCodeFence();
        expect(root.getChildrenSize()).toBe(1);
        expect(root.getTextContent()).toBe("```");
      },
      { discrete: true },
    );
  });
});
