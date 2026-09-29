import { describe, expect, it } from "vitest";
import { discussionLinks } from "./discussion-links";

describe("discussionLinks", () => {
  it("detects URLs without including prose punctuation", () => {
    expect(discussionLinks("See https://example.com/a, then www.example.org.")).toEqual([
      { text: "See " },
      { text: "https://example.com/a", href: "https://example.com/a" },
      { text: ", then " },
      { text: "www.example.org", href: "https://www.example.org" },
      { text: "." },
    ]);
  });
  it("preserves balanced parentheses and surrounding text", () => {
    const text = "(https://en.wikipedia.org/wiki/Fish_(disambiguation))";
    expect(
      discussionLinks(text)
        .map((part) => part.text)
        .join(""),
    ).toBe(text);
    expect(discussionLinks(text)[1]?.href).toBe(
      "https://en.wikipedia.org/wiki/Fish_(disambiguation)",
    );
  });
  it("does not turn unsafe schemes into links", () => {
    expect(discussionLinks("javascript:alert(1) data:text/html,test file:///tmp/test")).toEqual([
      { text: "javascript:alert(1) data:text/html,test file:///tmp/test" },
    ]);
  });
  it.each([
    "http://localhost:4180/tasks/137",
    "http://127.0.0.1:4180/tasks/137",
    "http://[::1]:4180/tasks/137",
    "https://example.technology/path?q=yes#section",
  ])("recognizes complete URLs: %s", (url) => {
    expect(discussionLinks(url)).toEqual([{ text: url, href: url }]);
  });
  it.each(["http://", "https://", "www.", "https://user:secret@example.com"])(
    "leaves incomplete or credential-bearing URLs as text: %s",
    (url) => {
      expect(discussionLinks(url)).toEqual([{ text: url }]);
    },
  );
});
