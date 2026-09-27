import { isCodeLanguageLoaded, PrismTokenizer } from "@lexical/code-prism";
import { Check, Copy } from "lucide-react";
import { createElement, type ReactNode, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type Token = ReturnType<typeof PrismTokenizer.tokenize>[number];

export function CodeBlock({ code, language }: { code: string; language: string }) {
  const [notice, setNotice] = useState("");
  const [copying, setCopying] = useState(false);
  const copied = notice === "Code copied.";
  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setNotice(""), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);
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
          className="min-h-11 w-32"
          aria-label={copied ? "Copy code: Copied" : "Copy code"}
          disabled={copying}
          onClick={async () => {
            setNotice("");
            setCopying(true);
            try {
              await navigator.clipboard.writeText(code);
              setNotice("Code copied.");
            } catch {
              setNotice("Copy unavailable. Select and copy the code.");
            } finally {
              setCopying(false);
            }
          }}
        >
          {copied ? (
            <Check aria-hidden="true" className="text-emerald-700 dark:text-emerald-300" />
          ) : (
            <Copy aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy code"}
        </Button>
      </div>
      <p role="status" className={notice && !copied ? "px-3 pb-2 text-xs" : "sr-only"}>
        {notice}
      </p>
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
