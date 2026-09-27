import { isCodeLanguageLoaded, PrismTokenizer } from "@lexical/code-prism";
import { createElement, type ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type Token = ReturnType<typeof PrismTokenizer.tokenize>[number];

export function CodeBlock({ code, language }: { code: string; language: string }) {
  const [notice, setNotice] = useState("");
  const highlighted = useMemo(() => {
    if (!isCodeLanguageLoaded(language)) return code;
    return PrismTokenizer.tokenize(code, language).map(renderToken);
  }, [code, language]);
  return (
    <div className="my-3 min-w-0 rounded-md border bg-muted">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3">
        <span className="text-xs text-muted-foreground">{language}</span>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setNotice("Code copied.");
            } catch {
              setNotice("Copy unavailable. Select and copy the code.");
            }
          }}
        >
          Copy code
        </Button>
        <span role="status" className="text-xs">
          {notice}
        </span>
      </div>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Long code lines need keyboard horizontal scrolling. */}
      <pre tabIndex={0}>
        <code>{highlighted}</code>
      </pre>
    </div>
  );
}

function renderToken(token: Token, key: number): ReactNode {
  if (typeof token === "string") return token;
  const content =
    typeof token.content === "string"
      ? token.content
      : Array.isArray(token.content)
        ? token.content.map(renderToken)
        : renderToken(token.content, 0);
  return createElement("span", { key, className: `syntax-${token.type}` }, content);
}
