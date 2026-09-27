import { CHECK_LIST, CODE, TRANSFORMERS } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import {
  $createParagraphNode,
  $getSelection,
  $isLineBreakNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  KEY_SPACE_COMMAND,
} from "lexical";
import { useEffect } from "react";
import { registerImmediateCodeFence } from "./editor-code-shortcut";

const transformers = [...TRANSFORMERS, CHECK_LIST];

// Lexical's block shortcuts require the text to be the paragraph's first child.
// Split only a complete fence on the final soft line, then let Lexical convert it.
export function $normalizeCodeFence() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
  const node = selection.anchor.getNode();
  if (
    !$isTextNode(node) ||
    !node.isSimpleText() ||
    node.hasFormat("code") ||
    selection.anchor.offset !== node.getTextContentSize()
  )
    return;
  const parent = node.getParent();
  const lineBreak = node.getPreviousSibling();
  if (
    !$isParagraphNode(parent) ||
    !$isRootNode(parent.getParent()) ||
    !$isLineBreakNode(lineBreak) ||
    node.getNextSibling() !== null
  )
    return;
  const text = node.getTextContent();
  if (CODE.regExpStart.exec(text)?.[0] !== text) return;
  const paragraph = $createParagraphNode();
  parent.insertAfter(paragraph);
  paragraph.append(node);
  lineBreak.remove();
  if (parent.isEmpty()) parent.remove();
  node.selectEnd();
}

export function EditorMarkdown() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => registerImmediateCodeFence(editor), [editor]);
  useEffect(() => {
    const normalize = (event: KeyboardEvent | null) => {
      if (
        !editor.isComposing() &&
        !event?.shiftKey &&
        !event?.ctrlKey &&
        !event?.metaKey &&
        !event?.altKey
      )
        $normalizeCodeFence();
      return false;
    };
    const removeEnter = editor.registerCommand(KEY_ENTER_COMMAND, normalize, COMMAND_PRIORITY_HIGH);
    const removeSpace = editor.registerCommand(KEY_SPACE_COMMAND, normalize, COMMAND_PRIORITY_HIGH);
    return () => {
      removeEnter();
      removeSpace();
    };
  }, [editor]);
  return <MarkdownShortcutPlugin transformers={transformers} />;
}
