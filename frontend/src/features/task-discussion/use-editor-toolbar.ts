import { $isCodeNode } from "@lexical/code-core";
import { $isLinkNode } from "@lexical/link";
import { $isListNode } from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getTableCellNodeFromLexicalNode } from "@lexical/table";
import {
  $findMatchingParent,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  mergeRegister,
  type RangeSelection,
  type TextFormatType,
} from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";

export type EditorAction = (action: () => void) => void;

const formats: TextFormatType[] = [
  "bold",
  "italic",
  "code",
  "underline",
  "strikethrough",
  "highlight",
  "subscript",
  "superscript",
];

function $toolbarState() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const node = selection.anchor.getNode();
  const code = $findMatchingParent(node, $isCodeNode);
  const list = $findMatchingParent(node, $isListNode);
  const link = $findMatchingParent(node, $isLinkNode);
  const block = node.getTopLevelElement();
  return {
    formats: new Set(formats.filter((format) => selection.hasFormat(format))),
    block: code ? "code" : (block?.getType() ?? "paragraph"),
    list: $isListNode(list) ? list.getListType() : null,
    link: $isLinkNode(link) ? link.getURL() : "",
    hasText: selection.getTextContent().length > 0,
    inTable: Boolean($getTableCellNodeFromLexicalNode(node)),
  };
}

export function useEditorToolbar() {
  const [editor] = useLexicalComposerContext();
  const savedSelection = useRef<RangeSelection | null>(null);
  const [state, setState] = useState(
    () =>
      editor.read($toolbarState) ?? {
        formats: new Set<TextFormatType>(),
        block: "paragraph",
        list: null,
        link: "",
        hasText: false,
        inTable: false,
      },
  );
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  useEffect(
    () =>
      mergeRegister(
        editor.registerUpdateListener(({ editorState }) =>
          editorState.read(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) savedSelection.current = selection.clone();
            const next = $toolbarState();
            if (next) setState(next);
          }),
        ),
        editor.registerCommand(
          CAN_UNDO_COMMAND,
          (value) => {
            setCanUndo(value);
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          CAN_REDO_COMMAND,
          (value) => {
            setCanRedo(value);
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
      ),
    [editor],
  );

  const run: EditorAction = useCallback(
    (action) => {
      if (!editor.isEditable()) return;
      editor.update(
        () => {
          if (!$getSelection()) {
            const saved = savedSelection.current;
            if (
              saved &&
              $getNodeByKey(saved.anchor.key)?.isAttached() &&
              $getNodeByKey(saved.focus.key)?.isAttached()
            )
              $setSelection(saved.clone());
            else $getRoot().selectEnd();
          }
          action();
        },
        { onUpdate: () => editor.focus() },
      );
    },
    [editor],
  );
  return { editor, state, run, canUndo, canRedo };
}
