import { $isCodeNode } from "@lexical/code-core";
import { getCodeLanguageOptions } from "@lexical/code-prism";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  type NodeKey,
} from "lexical";
import { CornerDownLeftIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { AppSelect } from "@/components/app-select";
import { Button } from "@/components/ui/button";
import type { EditorAction } from "./use-editor-toolbar";

const languages = [
  { value: "plain", label: "Plain text" },
  ...getCodeLanguageOptions().map(([value, label]) => ({ value, label })),
];

export function EditorCodeTools({ run }: { run: EditorAction }) {
  const [editor] = useLexicalComposerContext();
  const [active, setActive] = useState<{ key: NodeKey; language: string } | null>(null);
  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) =>
        editorState.read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          const node = selection.anchor.getNode();
          const code = $isCodeNode(node) ? node : node.getParent();
          setActive(
            $isCodeNode(code)
              ? { key: code.getKey(), language: code.getLanguage() ?? "plain" }
              : null,
          );
        }),
      ),
    [editor],
  );
  if (!active) return null;
  const options = languages.some((option) => option.value === active.language)
    ? languages
    : [...languages, { value: active.language, label: active.language }];
  return (
    <div className="flex flex-wrap items-center gap-2 p-2">
      <div className="min-w-0 flex-1">
        <AppSelect
          aria-label="Code language"
          value={active.language}
          options={options}
          onValueChange={(language) =>
            run(() => {
              const node = $getNodeByKey(active.key);
              if ($isCodeNode(node)) node.setLanguage(language);
            })
          }
        />
      </div>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={() =>
          run(() => {
            const node = $getNodeByKey(active.key);
            if ($isCodeNode(node)) {
              const paragraph = $createParagraphNode();
              node.insertAfter(paragraph);
              paragraph.select();
            }
          })
        }
      >
        <CornerDownLeftIcon aria-hidden="true" className="size-4" />
        Continue writing
      </Button>
    </div>
  );
}
