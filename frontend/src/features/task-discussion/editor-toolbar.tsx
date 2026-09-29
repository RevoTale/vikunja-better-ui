import { $createCodeNode } from "@lexical/code-core";
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import {
  $createParagraphNode,
  $getSelection,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from "lexical";
import {
  BoldIcon,
  CodeIcon,
  HeadingIcon,
  HighlighterIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MinusIcon,
  PilcrowIcon,
  QuoteIcon,
  Redo2Icon,
  SlidersHorizontalIcon,
  SquareCodeIcon,
  StrikethroughIcon,
  SubscriptIcon,
  SuperscriptIcon,
  UnderlineIcon,
  Undo2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EditorCodeTools } from "./editor-code-tools";
import { registerLinkEvents } from "./editor-link-events";
import { EditorLinkTools } from "./editor-link-tools";
import { EditorTableTools, InsertTable } from "./editor-table-tools";
import { EditorToolButton } from "./editor-tool-button";
import { useEditorToolbar } from "./use-editor-toolbar";

const textTools = [
  { format: "bold", label: "Bold", icon: BoldIcon },
  { format: "italic", label: "Italic", icon: ItalicIcon },
  { format: "code", label: "Inline code", icon: CodeIcon },
  { format: "underline", label: "Underline", icon: UnderlineIcon },
  { format: "strikethrough", label: "Strikethrough", icon: StrikethroughIcon },
  { format: "highlight", label: "Highlight", icon: HighlighterIcon },
  { format: "subscript", label: "Subscript", icon: SubscriptIcon },
  { format: "superscript", label: "Superscript", icon: SuperscriptIcon },
] as const;

export function EditorToolbar() {
  const { editor, state, run, canUndo, canRedo } = useEditorToolbar();
  const [showLink, setShowLink] = useState(false);
  useEffect(() => registerLinkEvents(editor, () => setShowLink(true)), [editor]);
  function textButtons(extended: boolean) {
    return textTools
      .slice(extended ? 3 : 0, extended ? undefined : 3)
      .map(({ format, label, icon }) => (
        <EditorToolButton
          key={format}
          label={label}
          icon={icon}
          compact={!extended && format !== "code"}
          active={state.formats.has(format)}
          disabled={state.block === "code"}
          onClick={() => run(() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format))}
        />
      ));
  }
  function paragraph() {
    if (state.list) editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    else $setBlocksType($getSelection(), $createParagraphNode);
  }
  const blocks = blockTools(editor, state);

  return (
    <div className="border-b p-1">
      <fieldset className="flex flex-wrap gap-1" aria-label="Text formatting">
        {textButtons(false)}
        <Button
          type="button"
          variant={state.link ? "secondary" : "ghost"}
          className="min-h-11 min-w-11"
          title="Link"
          aria-label="Link"
          aria-expanded={showLink}
          onMouseDown={(event) => event.preventDefault()}
          disabled={state.block === "code"}
          onClick={() => setShowLink(!showLink)}
        >
          <LinkIcon aria-hidden="true" className="size-4" />
        </Button>
        <EditorToolButton
          label="Undo"
          icon={Undo2Icon}
          compact
          disabled={!canUndo}
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        />
        <EditorToolButton
          label="Redo"
          icon={Redo2Icon}
          compact
          disabled={!canRedo}
          onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        />
        <details className="min-w-0 open:basis-full">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 focus-visible:ring-2 focus-visible:ring-ring">
            <SlidersHorizontalIcon aria-hidden="true" className="size-4" /> More formatting
          </summary>
          <div className="flex flex-wrap gap-1">
            {textButtons(true)}
            {blocks.map(({ label, icon, active, apply }) => (
              <EditorToolButton
                key={label}
                label={label}
                icon={icon}
                active={active}
                onClick={() => run(active ? paragraph : apply)}
              />
            ))}
            <EditorToolButton
              label="Paragraph"
              icon={PilcrowIcon}
              active={state.block === "paragraph" && !state.list}
              onClick={() => run(paragraph)}
            />
            <InsertTable run={run} disabled={state.inTable || state.block === "code"} />
            <EditorToolButton
              label="Separator"
              icon={MinusIcon}
              disabled={state.block === "code"}
              onClick={() =>
                run(() => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined))
              }
            />
          </div>
        </details>
      </fieldset>
      <EditorCodeTools run={run} />
      <EditorTableTools run={run} />
      {showLink ? (
        <EditorLinkTools
          initialUrl={state.link}
          canApply={state.hasText || Boolean(state.link)}
          run={run}
          onClose={() => setShowLink(false)}
        />
      ) : null}
    </div>
  );
}

function blockTools(
  editor: ReturnType<typeof useEditorToolbar>["editor"],
  state: ReturnType<typeof useEditorToolbar>["state"],
) {
  return [
    {
      label: "Code block",
      icon: SquareCodeIcon,
      active: state.block === "code",
      apply: () => $setBlocksType($getSelection(), () => $createCodeNode("plain")),
    },
    {
      label: "Heading",
      icon: HeadingIcon,
      active: state.block === "heading",
      apply: () => $setBlocksType($getSelection(), () => $createHeadingNode("h3")),
    },
    {
      label: "Quote",
      icon: QuoteIcon,
      active: state.block === "quote",
      apply: () => $setBlocksType($getSelection(), $createQuoteNode),
    },
    {
      label: "Bullets",
      icon: ListIcon,
      active: state.list === "bullet",
      apply: () => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
    },
    {
      label: "Numbered list",
      icon: ListOrderedIcon,
      active: state.list === "number",
      apply: () => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
    },
    {
      label: "Checklist",
      icon: ListTodoIcon,
      active: state.list === "check",
      apply: () => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined),
    },
  ];
}
