import { $isCodeNode } from "@lexical/code-core";
import { $isLinkNode } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalTypeaheadMenuPlugin, MenuOption } from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { $createTextNode, $findMatchingParent, $getSelection, $isRangeSelection } from "lexical";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { type EmojiChoice, emojiShortcodeMatch, findEmoji } from "./emoji-data";
import { useEmojiData } from "./use-emoji-data";

class EmojiOption extends MenuOption {
  readonly choice: EmojiChoice;
  constructor(choice: EmojiChoice) {
    super(choice.unicode);
    this.choice = choice;
  }
}

function $shortcodeTrigger(text: string) {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || selection.hasFormat("code")) return null;
  const node = selection.anchor.getNode();
  if ($findMatchingParent(node, (parent) => $isCodeNode(parent) || $isLinkNode(parent)))
    return null;
  return emojiShortcodeMatch(text);
}

// Lexical owns query splitting, keyboard navigation and selection restoration.
// https://lexical.dev/docs/react/plugins#lexicaltypeaheadmenuplugin
export function EditorEmojiShortcodes() {
  const [editor] = useLexicalComposerContext();
  const [parent, setParent] = useState<HTMLElement>();
  useEffect(
    () => editor.registerRootListener((root) => setParent(root?.parentElement ?? undefined)),
    [editor],
  );
  const [query, setQuery] = useState<string | null>(null);
  const { choices } = useEmojiData(query !== null);
  const options = useMemo(
    () =>
      query === null ? [] : findEmoji(choices, query, 6).map((choice) => new EmojiOption(choice)),
    [choices, query],
  );
  // Lexical appends its anchor during render; wait for the editor's local container.
  return parent ? (
    <LexicalTypeaheadMenuPlugin
      parent={parent}
      anchorClassName="empty:hidden!"
      options={options}
      onQueryChange={setQuery}
      triggerFn={$shortcodeTrigger}
      onSelectOption={(option, node, close) =>
        editor.update(() => {
          if (node) {
            const emoji = $createTextNode(option.choice.unicode);
            emoji.setFormat(node.getFormat());
            node.replace(emoji);
            emoji.selectEnd();
          }
          close();
        })
      }
      menuRenderFn={(anchor, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) =>
        anchor.current && options.length > 0
          ? createPortal(
              <div
                className="z-50 max-h-64 w-60 max-w-[calc(100vw-2rem)] overflow-auto rounded-md border bg-popover p-1 shadow-md"
                role="listbox"
                aria-label="Emoji suggestions"
              >
                {options.map((option, index) => (
                  <Button
                    key={option.key}
                    type="button"
                    role="option"
                    id={`typeahead-item-${index}`}
                    aria-selected={selectedIndex === index}
                    ref={(element) => option.setRefElement(element)}
                    variant={selectedIndex === index ? "secondary" : "ghost"}
                    className="min-h-11 w-full justify-start whitespace-normal text-left"
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => selectOptionAndCleanUp(option)}
                  >
                    <span aria-hidden="true">{option.choice.unicode}</span>
                    {option.choice.label}
                  </Button>
                ))}
              </div>,
              anchor.current,
            )
          : null
      }
    />
  ) : null;
}
