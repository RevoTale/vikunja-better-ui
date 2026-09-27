import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $getTableCellNodeFromLexicalNode,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  $isTableCellNode,
  $isTableSelection,
  INSERT_TABLE_COMMAND,
} from "@lexical/table";
import { $getNodeByKey, $getSelection, $isRangeSelection, type NodeKey } from "lexical";
import {
  BetweenHorizontalEndIcon,
  BetweenHorizontalStartIcon,
  BetweenVerticalEndIcon,
  BetweenVerticalStartIcon,
  Columns2Icon,
  Rows2Icon,
  Table2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { EditorToolButton } from "./editor-tool-button";
import type { EditorAction } from "./use-editor-toolbar";

export function InsertTable({ run, disabled }: { run: EditorAction; disabled: boolean }) {
  const [editor] = useLexicalComposerContext();
  return (
    <EditorToolButton
      label="Table"
      icon={Table2Icon}
      disabled={disabled}
      onClick={() =>
        run(() =>
          editor.dispatchCommand(INSERT_TABLE_COMMAND, {
            rows: "2",
            columns: "2",
            includeHeaders: true,
          }),
        )
      }
    />
  );
}

export function EditorTableTools({ run }: { run: EditorAction }) {
  const [editor] = useLexicalComposerContext();
  const [cellKey, setCellKey] = useState<NodeKey | null>(null);
  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) =>
        editorState.read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) && !$isTableSelection(selection)) return;
          setCellKey(
            $getTableCellNodeFromLexicalNode(selection.anchor.getNode())?.getKey() ?? null,
          );
        }),
      ),
    [editor],
  );
  if (!cellKey) return null;
  const actions = [
    {
      label: "Row above",
      icon: BetweenHorizontalStartIcon,
      apply: () => $insertTableRowAtSelection(false),
    },
    {
      label: "Row below",
      icon: BetweenHorizontalEndIcon,
      apply: () => $insertTableRowAtSelection(true),
    },
    {
      label: "Column before",
      icon: BetweenVerticalStartIcon,
      apply: () => $insertTableColumnAtSelection(false),
    },
    {
      label: "Column after",
      icon: BetweenVerticalEndIcon,
      apply: () => $insertTableColumnAtSelection(true),
    },
    { label: "Remove row", icon: Rows2Icon, apply: $deleteTableRowAtSelection },
    { label: "Remove column", icon: Columns2Icon, apply: $deleteTableColumnAtSelection },
  ];
  return (
    <fieldset aria-label="Table controls" className="flex flex-wrap gap-1 p-1">
      {actions.map(({ label, icon, apply }) => (
        <EditorToolButton
          key={label}
          label={label}
          icon={icon}
          onClick={() =>
            run(() => {
              const cell = $getNodeByKey(cellKey);
              if (!$isTableCellNode(cell)) return;
              cell.selectStart();
              apply();
            })
          }
        />
      ))}
    </fieldset>
  );
}
