import { $createCodeNode } from "@lexical/code-core";
import {
  $getSelection,
  $isLineBreakNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
  COLLABORATION_TAG,
  HISTORIC_TAG,
  HISTORY_PUSH_TAG,
  type LexicalEditor,
  PASTE_TAG,
} from "lexical";

// Only an otherwise empty final line in a root paragraph is a code shortcut.
function $codeFence(text: string) {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;
  const node = selection.anchor.getNode();
  if (
    !$isTextNode(node) ||
    !node.isSimpleText() ||
    node.hasFormat("code") ||
    node.getTextContent() !== text ||
    selection.anchor.offset !== text.length ||
    node.getNextSibling() !== null
  )
    return null;
  const parent = node.getParent();
  if (!$isParagraphNode(parent) || !$isRootNode(parent.getParent())) return null;
  const previous = node.getPreviousSibling();
  return previous === null || $isLineBreakNode(previous) ? node : null;
}

export function registerImmediateCodeFence(editor: LexicalEditor) {
  // Like Lexical's Markdown shortcuts, separate conversion from typing so Undo
  // restores the literal fence. Only the two-to-three transition schedules work.
  return editor.registerUpdateListener(({ editorState, prevEditorState, tags, dirtyLeaves }) => {
    if (
      editor.isComposing() ||
      tags.has(HISTORIC_TAG) ||
      tags.has(PASTE_TAG) ||
      tags.has(COLLABORATION_TAG)
    )
      return;
    const key = editorState.read(() => $codeFence("```")?.getKey());
    if (!key || !dirtyLeaves.has(key)) return;
    if (prevEditorState.read(() => $codeFence("``")?.getKey()) !== key) return;
    editor.update(
      () => {
        const node = $codeFence("```");
        if (!node) return;
        const parent = node.getParentOrThrow();
        const previous = node.getPreviousSibling();
        const code = $createCodeNode("plain");
        if ($isLineBreakNode(previous)) {
          parent.insertAfter(code);
          previous.remove();
          node.remove();
          if (parent.isEmpty()) parent.remove();
        } else {
          parent.replace(code);
        }
        code.selectStart();
      },
      { tag: HISTORY_PUSH_TAG },
    );
  });
}
